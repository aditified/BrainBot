import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext.jsx";
import "./AdminPage.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "fa-gauge-high" },
  { key: "users", label: "Users", icon: "fa-users" },
  { key: "threads", label: "Chat History", icon: "fa-comments" },
  { key: "analytics", label: "Analytics", icon: "fa-chart-line" },
  { key: "profile", label: "Admin Profile", icon: "fa-user-shield" },
];

function AdminPage() {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (!user?.isAdmin) navigate("/");
  }, []);

  if (!user?.isAdmin) return null;

  return (
    <div className="adminShell">
      <aside className="adminSidebar">
        <div className="brandRow">
          <img src="src/assets/bot.png" alt="gpt logo" className="logo2"></img>
          <span className="brandName2">BrainBot</span>
        </div>

        <nav className="adminNav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`adminNavItem ${activeTab === item.key ? "active" : ""}`}
              onClick={() => setActiveTab(item.key)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          className="adminLogout"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Log out</span>
        </button>
      </aside>

      <main className="adminMain">
        <header className="adminTopbar">
          <div className="adminBreadcrumb">
            <span>Admin</span>
            <i className="fa-solid fa-chevron-right"></i>
            <span className="current">
              {NAV_ITEMS.find((n) => n.key === activeTab)?.label}
            </span>
          </div>
          <div className="adminTopbarRight">
            <button className="adminBackBtn" onClick={() => navigate("/")}>
              <i className="fa-solid fa-arrow-left"></i> Back to Chat
            </button>
            <div className="adminAvatar">
              {user?.name?.[0]?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        <div className="adminContent">
          {activeTab === "dashboard" && <DashboardTab token={token} />}
          {activeTab === "users" && <UsersTab token={token} />}
          {activeTab === "threads" && <ThreadsTab token={token} />}
          {activeTab === "analytics" && <AnalyticsTab token={token} />}
          {activeTab === "profile" && <ProfileTab token={token} />}
        </div>
      </main>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
function DashboardTab({ token }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3000/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(console.log);
  }, []);

  if (!data) return <p className="adminLoading">Loading dashboard...</p>;

  const cards = [
    { label: "Total Users", value: data.totalUsers, icon: "fa-users" },
    {
      label: "Total Conversations",
      value: data.totalConversations,
      icon: "fa-comments",
    },
    { label: "Total Messages", value: data.totalMessages, icon: "fa-envelope" },
    { label: "Messages Today", value: data.messagesToday, icon: "fa-bolt" },
    {
      label: "Active Users Today",
      value: data.activeUsersToday,
      icon: "fa-circle-check",
    },
  ];

  return (
    <div>
      <div className="adminCardGrid">
        {cards.map((c) => (
          <div className="adminCard" key={c.label}>
            <div className="adminCardIcon">
              <i className={`fa-solid ${c.icon}`}></i>
            </div>
            <div>
              <div className="adminCardValue">{c.value}</div>
              <div className="adminCardLabel">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="adminPanelBox">
        <h3>Recent Activity</h3>
        <table className="adminTable">
          <thead>
            <tr>
              <th>Thread</th>
              <th>User</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.recentActivity.map((a) => (
              <tr key={a.threadId}>
                <td>{a.title}</td>
                <td>{a.user}</td>
                <td>{new Date(a.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- USERS ---------------- */
function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchUsers = () => {
    fetch(`http://localhost:3000/api/admin/users?search=${search}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setUsers)
      .catch(console.log);
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const toggleBlock = async (id) => {
    await fetch(`http://localhost:3000/api/admin/users/${id}/block`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user and all their threads?")) return;
    await fetch(`http://localhost:3000/api/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  return (
    <div className="adminPanelBox">
      <div className="adminTableHeader">
        <h3>Users ({users.length})</h3>
        <div className="adminSearchBox">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Search in table"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <table className="adminTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Block User</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u._id} className={i % 2 === 0 ? "" : "alt"}>
              <td>
                {u.name}{" "}
                {u.isAdmin && <span className="adminBadge">Admin</span>}
              </td>
              <td>{u.email}</td>
              <td>
                <span
                  className={`statusPill ${u.isBlocked ? "blocked" : "active"}`}
                >
                  {u.isBlocked ? "Blocked" : "Active"}
                </span>
              </td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="adminActions">
                <button
                  onClick={() => toggleBlock(u._id)}
                  title={u.isBlocked ? "Unblock" : "Block"}
                >
                  <i
                    className={`fa-solid ${u.isBlocked ? "fa-lock-open" : "fa-lock"}`}
                  ></i>
                </button>
                <button onClick={() => deleteUser(u._id)} title="Delete">
                  <i className="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- CHAT HISTORY ---------------- */
function ThreadsTab({ token }) {
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);

  const fetchThreads = () => {
    fetch(`http://localhost:3000/api/admin/threads?search=${search}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setThreads)
      .catch(console.log);
  };

  useEffect(() => {
    fetchThreads();
  }, [search]);

  const viewThread = async (threadId) => {
    const res = await fetch(
      `http://localhost:3000/api/admin/threads/${threadId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    setViewing(await res.json());
  };

  const deleteThread = async (threadId) => {
    if (!window.confirm("Delete this conversation?")) return;
    await fetch(`http://localhost:3000/api/admin/threads/${threadId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setViewing(null);
    fetchThreads();
  };

  if (viewing) {
    return (
      <div className="adminPanelBox">
        <div className="adminTableHeader">
          <button className="adminBackBtn" onClick={() => setViewing(null)}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
          <button
            className="adminDangerBtn"
            onClick={() => deleteThread(viewing.threadId)}
          >
            <i className="fa-solid fa-trash"></i> Delete
          </button>
        </div>
        <h3>{viewing.title}</h3>
        <p className="adminSubtleText">
          {viewing.userId?.name} ({viewing.userId?.email})
        </p>
        <div className="adminChatView">
          {viewing.messages.map((m) => (
            <div key={m._id} className={`adminChatBubble ${m.role}`}>
              <strong>{m.role}:</strong> {m.content}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="adminPanelBox">
      <div className="adminTableHeader">
        <h3>Conversations ({threads.length})</h3>
        <div className="adminSearchBox">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Search by user or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <table className="adminTable">
        <thead>
          <tr>
            <th>Title</th>
            <th>User</th>
            <th>Messages</th>
            <th>Updated</th>
            <th>View Chat</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((t, i) => (
            <tr key={t.threadId} className={i % 2 === 0 ? "" : "alt"}>
              <td>{t.title}</td>
              <td>{t.user?.name || "Unknown"}</td>
              <td>{t.messageCount}</td>
              <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
              <td className="adminActions">
                <button onClick={() => viewThread(t.threadId)} title="View">
                  <i className="fa-solid fa-eye"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- ANALYTICS ---------------- */
function AnalyticsTab({ token }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3000/api/admin/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(console.log);
  }, []);

  if (!data) return <p className="adminLoading">Loading analytics...</p>;

  const maxCount = Math.max(...data.messagesPerDay.map((d) => d.count), 1);

  return (
    <div>
      <div className="adminPanelBox">
        <h3>Messages Per Day (last 7 days)</h3>
        <div className="adminBarChart">
          {data.messagesPerDay.map((d) => (
            <div className="adminBarCol" key={d.date}>
              <div
                className="adminBar"
                style={{ height: `${(d.count / maxCount) * 100}%` }}
              ></div>
              <span>{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="adminPanelBox">
        <h3>Most Active Users</h3>
        <table className="adminTable">
          <thead>
            <tr>
              <th>User</th>
              <th>Messages</th>
            </tr>
          </thead>
          <tbody>
            {data.mostActiveUsers.map((u) => (
              <tr key={u.name}>
                <td>{u.name}</td>
                <td>{u.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- ADMIN PROFILE ---------------- */
function ProfileTab({ token }) {
  const { user } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("");
    const res = await fetch("http://localhost:3000/api/admin/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to update");
      return;
    }
    setMessage("Profile updated successfully");
    setCurrentPassword("");
    setNewPassword("");
  };

  return (
    <div className="adminPanelBox adminForm">
      <h3>Admin Profile</h3>
      {message && <p className="adminMessage">{message}</p>}

      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />

      <label>Email</label>
      <input value={user?.email} disabled />

      <label>Current Password</label>
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />

      <label>New Password</label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />

      <button className="adminSaveBtn" onClick={save}>
        Update Profile
      </button>
    </div>
  );
}

export default AdminPage;
