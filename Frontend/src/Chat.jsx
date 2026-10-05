import "./Chat.css";
import React, { useContext, useState, useEffect, useMemo } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { AuthContext } from "./AuthContext.jsx";
import { API_BASE_URL } from "./config.js";

const CALL_TO_ACTION = [
  "Let's get started.",
  "Ask away.",
  "What's on your mind?",
  "Ready when you are.",
];

function Chat() {
  const { newChat, prevChats, reply, setPrevChats, currThreadId, setReply } =
    useContext(MyContext);
  const { token } = useContext(AuthContext);
  const [latestReply, setLatestReply] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [updating, setUpdating] = useState(false);
  const greetingLine = useMemo(
    () => CALL_TO_ACTION[Math.floor(Math.random() * CALL_TO_ACTION.length)],
    [],
  );

  useEffect(() => {
    if (reply === null) {
      setLatestReply(null); //prevchat load
      return;
    }

    if (!prevChats?.length) return;

    const content = reply.split(" "); //individual words

    let idx = 0;
    const interval = setInterval(() => {
      setLatestReply(content.slice(0, idx + 1).join(" "));

      idx++;
      if (idx >= content.length) clearInterval(interval);
    }, 40);

    return () => clearInterval(interval);
  }, [prevChats, reply]);

  const startEdit = (chat, idx) => {
    setEditingId(chat._id || idx);
    setEditValue(chat.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (chat) => {
    if (!editValue.trim() || !chat._id) {
      cancelEdit();
      return;
    }

    setUpdating(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/thread/${currThreadId}/message/${chat._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: editValue }),
        },
      );

      const res = await response.json();

      if (res.messages) {
        setPrevChats(res.messages);
        setReply(null); // skip typing animation for the regenerated reply
      }
    } catch (err) {
      console.log(err);
    }

    setUpdating(false);
    cancelEdit();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {newChat && (
        <div className="emptyState">
          <h1 className="emptyStateHeading">{greetingLine}</h1>
        </div>
      )}
      <div className="chats">
        {prevChats?.slice(0, -1).map((chat, idx) => (
          <div
            className={chat.role === "user" ? "userDiv" : "gptDiv"}
            key={chat._id || idx}
          >
            {chat.role === "user" ? (
              editingId === (chat._id || idx) ? (
                <div className="editBox">
                  <textarea
                    className="editInput"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit(chat);
                      }
                    }}
                    autoFocus
                    rows={Math.min(6, editValue.split("\n").length + 1)}
                  />
                  <div className="editActions">
                    <button
                      className="editCancel"
                      onClick={cancelEdit}
                      disabled={updating}
                    >
                      Cancel
                    </button>
                    <button
                      className="editSave"
                      onClick={() => saveEdit(chat)}
                      disabled={updating}
                    >
                      {updating ? "Saving..." : "Save & Submit"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="userMessage">
                  {chat.content}
                  {chat._id && (
                    <i
                      className="fa-solid fa-pen editIcon"
                      onClick={() => startEdit(chat, idx)}
                    ></i>
                  )}
                </p>
              )
            ) : (
              <>
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {chat.content}
                </ReactMarkdown>
                {chat.timestamp && (
                  <span className="msgTime">{formatTime(chat.timestamp)}</span>
                )}
              </>
            )}
          </div>
        ))}

        {prevChats.length > 0 && (
          <>
            {latestReply === null ? (
              <div className="gptDiv" key={"non-typing"}>
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {prevChats[prevChats.length - 1].content}
                </ReactMarkdown>
                {prevChats[prevChats.length - 1].timestamp && (
                  <span className="msgTime">
                    {formatTime(prevChats[prevChats.length - 1].timestamp)}
                  </span>
                )}
              </div>
            ) : (
              <div className="gptDiv" key={"typing"}>
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {latestReply}
                </ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default Chat;
