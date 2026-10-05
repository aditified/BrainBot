import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "./AuthContext.jsx";
import SplineBot from "./SplineBot.jsx";
import "./Auth.css";
import { API_BASE_URL } from "./config.js";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      login(data.user, data.token);
      navigate("/");
    } catch (err) {
      console.log(err);
      setError("Something went wrong. Try again.");
    }

    setLoading(false);
  };

  return (
    <div className="authWrapper">
      <div className="authPanel">
        <div className="authVisual">
          <div className="splineStage">
            <SplineBot />
          </div>
        </div>

        <div className="authFormSide">
          <h1>Sign up</h1>
          <p className="authSubtitle">Create your account to get started</p>

          <form className="authBox" onSubmit={handleSubmit}>
            {error && <p className="authError">{error}</p>}

            <div className="authInputGroup">
              <i className="fa-solid fa-user"></i>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="authInputGroup">
              <i className="fa-solid fa-envelope"></i>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="authInputGroup">
              <i className="fa-solid fa-lock"></i>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </button>

            <p className="authSwitch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Signup;
