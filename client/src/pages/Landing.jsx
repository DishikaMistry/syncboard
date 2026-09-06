import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // If already logged in, show option to go to board
  if (user) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.logo}>SyncBoard</h1>
            <nav style={styles.nav}>
              <button onClick={() => navigate('/board')} style={styles.primaryButton}>
                Go to Board
              </button>
            </nav>
          </div>
        </header>

        <main style={styles.hero}>
          <div style={styles.heroContent}>
            <h1 style={styles.title}>
              Collaborate in Real-Time,
              <br />
              <span style={styles.titleAccent}>Even Offline</span>
            </h1>
            <p style={styles.subtitle}>
              A powerful Kanban board that keeps your team in sync with intelligent
              conflict resolution and seamless offline support.
            </p>
            <div style={styles.buttonGroup}>
              <button onClick={() => navigate('/board')} style={styles.ctaButton}>
                Open Your Board
              </button>
            </div>
          </div>
        </main>

        <section style={styles.features}>
          <div style={styles.featuresGrid}>
            <FeatureCard
              icon="🔄"
              title="Real-Time Sync"
              description="See changes instantly as your team collaborates across multiple devices"
            />
            <FeatureCard
              icon="📴"
              title="Offline First"
              description="Work without internet. Changes sync automatically when you reconnect"
            />
            <FeatureCard
              icon="🤝"
              title="Smart Conflicts"
              description="Field-level conflict resolution using Hybrid Logical Clocks ensures consistency"
            />
            <FeatureCard
              icon="💬"
              title="Team Collaboration"
              description="Comment on cards, assign tasks, and keep everyone on the same page"
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>SyncBoard</h1>
          <nav style={styles.nav}>
            <button onClick={() => navigate('/login')} style={styles.secondaryButton}>
              Log In
            </button>
            <button onClick={() => navigate('/login', { state: { isRegister: true } })} style={styles.primaryButton}>
              Get Started
            </button>
          </nav>
        </div>
      </header>

      <main style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.title}>
            Collaborate in Real-Time,
            <br />
            <span style={styles.titleAccent}>Even Offline</span>
          </h1>
          <p style={styles.subtitle}>
            A powerful Kanban board that keeps your team in sync with intelligent
            conflict resolution and seamless offline support.
          </p>
          <div style={styles.buttonGroup}>
            <button onClick={() => navigate('/login', { state: { isRegister: true } })} style={styles.ctaButton}>
              Get Started Free
            </button>
            <button onClick={() => scrollToFeatures()} style={styles.secondaryCtaButton}>
              Learn More
            </button>
          </div>
        </div>
      </main>

      <section style={styles.features} id="features">
        <div style={styles.featuresContent}>
          <h2 style={styles.featuresTitle}>Why Choose SyncBoard?</h2>
          <div style={styles.featuresGrid}>
            <FeatureCard
              icon="🔄"
              title="Real-Time Sync"
              description="See changes instantly as your team collaborates across multiple devices"
            />
            <FeatureCard
              icon="📴"
              title="Offline First"
              description="Work without internet. Changes sync automatically when you reconnect"
            />
            <FeatureCard
              icon="🤝"
              title="Smart Conflicts"
              description="Field-level conflict resolution using Hybrid Logical Clocks ensures consistency"
            />
            <FeatureCard
              icon="💬"
              title="Team Collaboration"
              description="Comment on cards, assign tasks, and keep everyone on the same page"
            />
            <FeatureCard
              icon="🎨"
              title="Drag & Drop"
              description="Intuitive interface with smooth drag-and-drop for effortless organization"
            />
            <FeatureCard
              icon="🔐"
              title="Secure & Private"
              description="Your data is protected with authentication and secure connections"
            />
          </div>
        </div>
      </section>

      <section style={styles.cta}>
        <div style={styles.ctaContent}>
          <h2 style={styles.ctaTitle}>Ready to Get Started?</h2>
          <p style={styles.ctaText}>
            Join teams who are already collaborating seamlessly with SyncBoard
          </p>
          <button onClick={() => navigate('/login', { state: { isRegister: true } })} style={styles.ctaButtonLarge}>
            Create Your Board Now
          </button>
        </div>
      </section>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          © 2026 SyncBoard. Built with conflict-free sync technology.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div style={styles.featureCard}>
      <div style={styles.featureIcon}>{icon}</div>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureDescription}>{description}</p>
    </div>
  );
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  
  // Header styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '20px 0',
    zIndex: 10,
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  },
  headerContent: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 28,
    fontWeight: 700,
    color: 'white',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  nav: {
    display: 'flex',
    gap: 12,
  },
  primaryButton: {
    padding: '10px 24px',
    background: 'white',
    color: '#667eea',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryButton: {
    padding: '10px 24px',
    background: 'transparent',
    color: 'white',
    border: '2px solid white',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },

  // Hero section styles
  hero: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    position: 'relative',
    padding: '100px 24px 60px',
  },
  heroContent: {
    maxWidth: 800,
    color: 'white',
  },
  title: {
    fontSize: 64,
    fontWeight: 800,
    margin: '0 0 24px',
    lineHeight: 1.1,
    letterSpacing: '-2px',
  },
  titleAccent: {
    background: 'linear-gradient(90deg, #ffd89b 0%, #19547b 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 1.6,
    margin: '0 0 40px',
    opacity: 0.95,
    maxWidth: 600,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  buttonGroup: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  ctaButton: {
    padding: '16px 40px',
    background: 'white',
    color: '#667eea',
    border: 'none',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  },
  secondaryCtaButton: {
    padding: '16px 40px',
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '2px solid white',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s',
    backdropFilter: 'blur(10px)',
  },

  // Features section styles
  features: {
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '80px 24px',
  },
  featuresContent: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  featuresTitle: {
    fontSize: 42,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 60,
    color: '#333',
    letterSpacing: '-1px',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 32,
    maxWidth: 1200,
    margin: '0 auto',
  },
  featureCard: {
    padding: 32,
    background: 'white',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: 700,
    margin: '0 0 12px',
    color: '#333',
  },
  featureDescription: {
    fontSize: 15,
    lineHeight: 1.6,
    color: '#666',
    margin: 0,
  },

  // CTA section styles
  cta: {
    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
    padding: '100px 24px',
    textAlign: 'center',
  },
  ctaContent: {
    maxWidth: 700,
    margin: '0 auto',
    color: 'white',
  },
  ctaTitle: {
    fontSize: 48,
    fontWeight: 800,
    margin: '0 0 20px',
    letterSpacing: '-1px',
  },
  ctaText: {
    fontSize: 20,
    lineHeight: 1.6,
    margin: '0 0 40px',
    opacity: 0.95,
  },
  ctaButtonLarge: {
    padding: '18px 48px',
    background: 'white',
    color: '#667eea',
    border: 'none',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },

  // Footer styles
  footer: {
    background: 'rgba(0, 0, 0, 0.2)',
    padding: '24px',
    textAlign: 'center',
  },
  footerText: {
    color: 'white',
    margin: 0,
    fontSize: 14,
    opacity: 0.8,
  },
};
