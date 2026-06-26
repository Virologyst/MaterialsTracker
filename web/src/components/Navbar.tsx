import { Link, useNavigate } from 'react-router-dom';

const navStyle: React.CSSProperties = {
  background: '#1a1a2e',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  padding: '0 24px',
  height: 56,
  gap: 24,
};

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 500,
};

const logoutStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.4)',
  color: 'white',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.9rem',
};

export default function Navbar() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <nav style={navStyle}>
      <Link to="/" style={{ ...linkStyle, fontWeight: 700, fontSize: '1.1rem' }}>
        Materials Tracker
      </Link>
      <Link to="/" style={linkStyle}>Scan</Link>
      <Link to="/groups" style={linkStyle}>Groups</Link>
      <Link to="/materials" style={linkStyle}>Materials</Link>
      <Link to="/import" style={linkStyle}>Import</Link>
      <Link to="/reports" style={linkStyle}>Reports</Link>
      <Link to="/admin" style={linkStyle}>Admin</Link>
      <button style={logoutStyle} onClick={handleLogout}>Log out</button>
    </nav>
  );
}
