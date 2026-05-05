import React from 'react';

interface MockWebsiteProps {
  cardPadding?: number;
  heroFontSize?: number;
}

export const MockWebsite: React.FC<MockWebsiteProps> = ({
  cardPadding,
  heroFontSize,
}) => {
  const mono = "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace";

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        fontFamily: mono,
        fontSize: 14,
        overflow: 'hidden',
      }}
    >
      {/* Nav */}
      <nav
        data-mock="nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 48px',
          borderBottom: '1px solid #21262d',
        }}
      >
        <span style={{ color: '#00ff41', fontWeight: 700, fontSize: 18 }}>
          acme.dev
        </span>
        <div style={{ display: 'flex', gap: 32, fontSize: 13, color: '#8b949e' }}>
          <span>Features</span>
          <span>Pricing</span>
          <span>Docs</span>
          <span style={{ color: '#00ff41' }}>Login</span>
        </div>
      </nav>

      {/* Hero */}
      <section
        data-mock="hero"
        style={{
          padding: '80px 48px 60px',
          maxWidth: 800,
        }}
      >
        <h1
          data-mock="hero-heading"
          style={{
            fontSize: heroFontSize ?? 56,
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#e6edf3',
            marginBottom: 20,
          }}
        >
          Ship faster with <span style={{ color: '#00ff41' }}>terminal-grade</span>{' '}
          tooling
        </h1>
        <p
          data-mock="hero-sub"
          style={{ fontSize: 16, color: '#8b949e', lineHeight: 1.6, maxWidth: 560, marginBottom: 32 }}
        >
          Build, test, and deploy from your CLI. No bloated GUIs. Just code.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            data-mock="cta-primary"
            style={{
              background: '#00ff41',
              color: '#0d1117',
              border: 'none',
              padding: '12px 28px',
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Get Started
          </button>
          <button
            data-mock="cta-secondary"
            style={{
              background: 'none',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              padding: '12px 28px',
              fontFamily: mono,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            View Demo
          </button>
        </div>
      </section>

      {/* Feature cards */}
      <section
        data-mock="features"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          padding: '0 48px 60px',
        }}
      >
        {[
          { icon: '>', title: 'CLI-first', desc: 'Every feature accessible from your terminal' },
          { icon: '#', title: 'Config-free', desc: 'Zero-config defaults that just work' },
          { icon: '$', title: 'Fast deploys', desc: 'Push to production in under 3 seconds' },
        ].map((f) => (
          <div
            key={f.title}
            data-mock="feature-card"
            style={{
              background: '#161b22',
              border: '1px solid #21262d',
              padding: cardPadding ?? 28,
              transition: 'padding 0.1s',
            }}
          >
            <div style={{ color: '#00ff41', fontSize: 24, marginBottom: 12 }}>
              {f.icon}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3', marginBottom: 8 }}>
              {f.title}
            </h3>
            <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.5 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      {/* Code block */}
      <section data-mock="code-block" style={{ padding: '0 48px 60px' }}>
        <div
          style={{
            background: '#0d1117',
            border: '1px solid #21262d',
            padding: 24,
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          <div style={{ color: '#8b949e' }}>{'$ acme init my-project'}</div>
          <div style={{ color: '#00ff41' }}>{'  creating project...'}</div>
          <div style={{ color: '#00ff41' }}>{'  installing deps...'}</div>
          <div style={{ color: '#c9d1d9' }}>{'  done in 1.2s'}</div>
          <div style={{ marginTop: 8, color: '#8b949e' }}>{'$ acme deploy'}</div>
          <div style={{ color: '#00ff41' }}>{'  deployed to https://my-project.acme.dev'}</div>
        </div>
      </section>
    </div>
  );
};
