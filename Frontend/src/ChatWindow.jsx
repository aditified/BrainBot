import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { AuthContext } from "./AuthContext.jsx";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScaleLoader } from "react-spinners";
import userLogo from "./assets/user.jpeg";
import { API_BASE_URL } from "./config.js";

const BLOCKED_ACCOUNT_MESSAGE =
  "You have been blocked by the admin. Once you are unblocked, you can log back in.";

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    setReply,
    currThreadId,
    prevChats,
    setPrevChats,
    newChat,
    setNewChat,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useContext(MyContext);
  const { user, logout, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const getReply = async () => {
    const message = prompt.trim();
    if (!message || loading) return;

    const messagesBeforeRequest = prevChats;

    setLoading(true);
    setNewChat(false);
    setReply(null);
    setPrevChats((previous) => [
      ...previous,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);
    setPrompt("");

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        threadId: currThreadId,
      }),
    };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat`,
        options,
      );
      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.error || "Unable to start the response stream.",
        );
        error.status = response.status;
        throw error;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event) => {
        const eventType = event
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (!eventType || !dataLine) return;
        const data = JSON.parse(dataLine.slice(5).trim());

        if (eventType === "delta") {
          setPrevChats((previous) => {
            const updated = [...previous];
            const lastMessage = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...lastMessage,
              content: `${lastMessage.content}${data.text}`,
            };
            return updated;
          });
        }

        if (eventType === "done" && data.messages) {
          setPrevChats(data.messages);
        }

        if (eventType === "error") {
          throw new Error(data.error || "Unable to generate a response.");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder
          .decode(value || new Uint8Array(), { stream: !done })
          .replace(/\r\n/g, "\n");

        let separatorIndex;
        while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          handleEvent(event);
        }

        if (done) break;
      }
    } catch (err) {
      console.log(err);

      if (err.status === 403) {
        setPrevChats(messagesBeforeRequest);
        alert(err.message || BLOCKED_ACCOUNT_MESSAGE);
        logout();
        navigate("/login");
        return;
      }

      setPrevChats((previous) => {
        const updated = [...previous];
        const lastMessage = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...lastMessage,
          content:
            err.message || "Sorry, I couldn't generate a response right now.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="chatWindow">
      <div className="navbar">
        <div className="navbarLeft">
          {!isSidebarOpen && (
            <button
              className="expandBtn"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Expand sidebar"
            >
              <i className="fa-solid fa-angles-right"></i>
            </button>
          )}
        </div>
        <div className="userIconDiv" onClick={handleProfileClick}>
          <span className="userIcon">
            <i className="fa-solid fa-user">
              <img className="userlogo" src={userLogo} alt="user" />
            </i>
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="dropDown">
          {user?.isAdmin && (
            <div className="dropDownItem" onClick={() => navigate("/admin")}>
              <i className="fa-solid fa-shield-halved"></i> Admin Panel
            </div>
          )}
          <div className="dropDownItem">
            <i className="fa-solid fa-gear"></i> Settings
          </div>
          <div className="dropDownItem">
            <i className="fa-solid fa-cloud-arrow-up"></i> Upgrade plan
          </div>
          <div className="dropDownItem" onClick={handleLogout}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Log out
          </div>
        </div>
      )}
      <div className={`mainArea ${newChat ? "centered" : ""}`}>
        <Chat></Chat>

        <ScaleLoader color="#fff" loading={loading}></ScaleLoader>

        <div className="chatInput">
          <div className="inputBox">
            <input
              placeholder="Ask anything"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? getReply() : "")}
            ></input>
            <div id="submit" onClick={getReply}>
              <i className="fa-solid fa-paper-plane"></i>
            </div>
          </div>
          <p className="info">
            BrainBot can make mistakes. Check important info. See Cookie
            Preferences.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
