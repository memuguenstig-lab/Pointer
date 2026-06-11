import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { emailProviders, quickLinks, linkCategories, QuickLink, EmailProviderLink } from '../config/links';

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  fontWeight: 700,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
  padding: 12,
  overflow: 'auto',
};

const cardStyleBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 12,
  border: '1px solid var(--border-color)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
  boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

function groupLinks(items: QuickLink[]) {
  return linkCategories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

function matchesQuery(text: string, query: string) {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

const ChainIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
    <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
  </svg>
);

const MailIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const LinksView: React.FC = () => {
  const [launching, setLaunching] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailChooserOpen, setEmailChooserOpen] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');

  const filteredLinks = useMemo(() => {
    return quickLinks.filter((link) => {
      const haystack = `${link.name} ${link.description} ${link.category}`;
      return matchesQuery(haystack, searchQuery);
    });
  }, [searchQuery]);

  const filteredEmailOptions = useMemo(() => {
    return emailProviders.filter((provider) => {
      const haystack = `${provider.name} ${provider.description} ${provider.category}`;
      return matchesQuery(haystack, emailSearchQuery);
    });
  }, [emailSearchQuery]);

  const groupedLinks = useMemo(() => groupLinks(filteredLinks), [filteredLinks]);

  const handleLaunch = async (link: QuickLink) => {
    setLaunching(link.id);
    try {
      if (link.action.type === 'external') {
        const result = await window.electron?.openExternal?.(link.action.url);
        if (result && !result.success) {
          console.error(result.error || `Failed to open ${link.name}`);
        }
      } else {
        const result = await window.electron?.launchNativeApp?.(link.action.appId, link.action.args);
        if (result && !result.success) {
          console.error(result.error || `Failed to launch ${link.name}`);
        }
      }
    } finally {
      setLaunching(null);
    }
  };

  const handleEmailOpen = async (provider: EmailProviderLink) => {
    await handleLaunch(provider);
    setEmailChooserOpen(false);
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Connections</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Quick access to email, cloud services, to-do apps, and local tools.
        </div>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              shadowideEvents: 'none',
            }}
          >
            <SearchIcon />
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search links..."
            style={{
              ...inputStyle,
              paddingLeft: 34,
            }}
          />
        </div>
      </div>

      <div style={{ padding: '10px 12px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={() => setEmailChooserOpen(true)}
          style={{
            ...cardStyleBase,
            padding: '10px 12px',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'shadowide',
            minWidth: 220,
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                boxShadow: '0 8px 18px rgba(59,130,246,0.25)',
                flexShrink: 0,
              }}
            >
              <MailIcon size={17} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Connect email</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Gmail, GMX, Proton Mail, Outlook, and more.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              border: '1px solid var(--border-color)',
              borderRadius: 999,
              padding: '4px 8px',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
            }}
          >
            Connect
          </span>
        </button>
      </div>

      <div style={gridStyle}>
        {groupedLinks.map((group) => (
          <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={sectionLabelStyle}>{group.category}</div>
            {group.items.map((link) => (
              <button
                key={link.id}
                onClick={() => handleLaunch(link)}
                disabled={launching === link.id}
                style={{
                  ...cardStyleBase,
                  textAlign: 'left',
                  cursor: launching === link.id ? 'wait' : 'shadowide',
                  opacity: launching === link.id ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: link.accent,
                      boxShadow: `0 0 0 4px ${link.accent}22`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{link.name}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {link.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.9 }}>
                  {launching === link.id ? 'Opening...' : link.action.label}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 12px 14px', color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>
        Add more entries in <code>src/config/links.ts</code>.
      </div>

      <Modal
        isOpen={emailChooserOpen}
        onClose={() => setEmailChooserOpen(false)}
        title="Choose email provider"
        width="720px"
        height="70vh"
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Pick a provider to open. You can extend this list anytime in the link config.
            </div>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  shadowideEvents: 'none',
                }}
              >
                <SearchIcon />
              </span>
              <input
                value={emailSearchQuery}
                onChange={(e) => setEmailSearchQuery(e.target.value)}
                placeholder="Search email providers..."
                style={{
                  ...inputStyle,
                  paddingLeft: 34,
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {filteredEmailOptions.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleEmailOpen(provider)}
                  disabled={launching === provider.id}
                  style={{
                    ...cardStyleBase,
                    cursor: launching === provider.id ? 'wait' : 'shadowide',
                    textAlign: 'left',
                    opacity: launching === provider.id ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: provider.accent,
                        boxShadow: `0 0 0 4px ${provider.accent}22`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{provider.name}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {provider.description}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {launching === provider.id ? 'Opening...' : 'Connect'}
                  </div>
                </button>
              ))}
              {filteredEmailOptions.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 2px' }}>
                  No providers match your search.
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
};

export default LinksView;
