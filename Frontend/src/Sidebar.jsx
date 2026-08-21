import "./Sidebar.css";
import { useContext, useEffect } from "react";
import { MyContext } from "./MyContext.jsx";
import { AuthContext } from "./AuthContext.jsx";
import { v1 as uuidv1 } from "uuid";

function Sidebar() {
  const {
    allThreads,
    setAllThreads,
    currThreadId,
    setNewChat,
    setPrompt,
    setReply,
    setCurrThreadId,
    setPrevChats,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useContext(MyContext);
  const { token } = useContext(AuthContext);

  const getAllThreads = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/thread", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await response.json();
      const filteredData = res.map((thread) => ({
        threadId: thread.threadId,
        title: thread.title,
      }));
      setAllThreads(filteredData);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (token) getAllThreads();
  }, [currThreadId, token]);

  const createNewChat = () => {
    setNewChat(true);
    setPrompt("");
    setReply(null);
    setCurrThreadId(uuidv1());
    setPrevChats([]);
  };

  const changeThread = async (newThreadId) => {
    setCurrThreadId(newThreadId);

    try {
      const response = await fetch(
        `http://localhost:3000/api/thread/${newThreadId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const res = await response.json();
      setPrevChats(res);
      setNewChat(false);
      setReply(null);
    } catch (err) {
      console.log(err);
    }
  };

  const deleteThread = async (threadId) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/thread/${threadId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const res = await response.json();

      setAllThreads((prev) =>
        prev.filter((thread) => thread.threadId !== threadId),
      );

      if (threadId === currThreadId) {
        createNewChat();
      }
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <aside className={`sidebar ${isSidebarOpen ? "" : "closed"}`}>
      <div className="sidebarInner">
        <div className="sidebarTop">
          <div className="brandRow">
            <img src="src/assets/bot.png" alt="gpt logo" className="logo"></img>
            <span className="brandName">BrainBot</span>
            <button
              className="collapseBtn"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Collapse sidebar"
            >
              <i className="fa-solid fa-angles-left"></i>
            </button>
          </div>

          <button className="newChatBtn" onClick={createNewChat}>
            <i className="fa-solid fa-pen-to-square"></i>
            <span>New chat</span>
          </button>
        </div>

        <ul className="history">
          {allThreads?.map((thread, idx) => (
            <li
              key={idx}
              onClick={(e) => changeThread(thread.threadId)}
              className={thread.threadId === currThreadId ? "highlighted" : " "}
            >
              {thread.title}
              <i
                className="fa-solid fa-trash"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteThread(thread.threadId);
                }}
              ></i>
            </li>
          ))}
        </ul>

        <div className="sign">
          <p>By Aditi Maurya &hearts;</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
