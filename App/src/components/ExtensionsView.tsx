import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '../config/apiConfig';

interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  downloads?: string;
  rating?: number;
  icon?: string;
  installed?: boolean;
  repository?: string;
}

export const ExtensionsView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [registry, setRegistry] = useState<Extension[]>([]);
  const [installed, setInstalled] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExtensions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch installed list
      const installedRes = await fetch(buildApiUrl('/api/extensions/installed'));
      const installedData = await installedRes.json();
      
      // Fetch registry index
      const registryRes = await fetch(buildApiUrl('/api/extensions/registry'));
      let registryData = [];
      if (registryRes.ok) {
        registryData = await registryRes.json();
      }

      setInstalled(installedData || []);
      setRegistry(registryData || []);
    } catch (e: any) {
      console.error(e);
      // Fail silently or set custom message
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleInstall = async (ext: Extension) => {
    if (!ext.repository) return;
    setInstallingId(ext.id);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/extensions/install'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ext.id, repository: ext.repository })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to install extension');
      }
      await fetchExtensions();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (id: string) => {
    setUninstallingId(id);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/extensions/uninstall'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to uninstall extension');
      }
      await fetchExtensions();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUninstallingId(null);
    }
  };

  // Build complete list by combining registry and marking what is installed
  const installedIds = new Set(installed.map(ext => ext.id));
  
  const allExtensions: Extension[] = [
    ...installed.map(ext => ({ ...ext, installed: true })),
    ...registry
      .filter(ext => !installedIds.has(ext.id))
      .map(ext => ({ ...ext, installed: false }))
  ];

  const filtered = allExtensions.filter(ext =>
    ext.name.toLowerCase().includes(search.toLowerCase()) ||
    ext.description.toLowerCase().includes(search.toLowerCase())
  );

  const installedList = filtered.filter(ext => ext.installed);
  const recommendedList = filtered.filter(ext => !ext.installed);

  const renderExtensionRow = (ext: Extension) => {
    const isInstalling = installingId === ext.id;
    const isUninstalling = uninstallingId === ext.id;

    return (
      <div
        key={ext.id}
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          transition: 'transform 0.15s, border-color 0.15s',
          marginBottom: 8,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent-color)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Icon */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}>
          {ext.icon || '🧩'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ext.name}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {ext.description}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
            <span>{ext.author || 'Unknown'}</span>
            <span>•</span>
            <span>v{ext.version}</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 }}>
          {ext.installed ? (
            <button
              disabled={isUninstalling}
              onClick={() => handleUninstall(ext.id)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid var(--error-color)',
                background: 'transparent',
                color: 'var(--error-color)',
                fontSize: 10,
                fontWeight: 600,
                cursor: isUninstalling ? 'default' : 'pointer',
                transition: 'background 0.15s, color 0.15s',
                opacity: isUninstalling ? 0.7 : 1,
              }}
              onMouseEnter={e => {
                if (!isUninstalling) {
                  e.currentTarget.style.background = 'var(--error-color)';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                if (!isUninstalling) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--error-color)';
                }
              }}
            >
              {isUninstalling ? 'Uninstalling...' : 'Uninstall'}
            </button>
          ) : (
            <button
              disabled={isInstalling}
              onClick={() => handleInstall(ext)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: isInstalling ? '1px solid var(--border-color)' : 'none',
                background: isInstalling ? 'var(--bg-secondary)' : 'var(--accent-color)',
                color: isInstalling ? 'var(--text-secondary)' : '#fff',
                fontSize: 10,
                fontWeight: 600,
                cursor: isInstalling ? 'default' : 'pointer',
                opacity: isInstalling ? 0.7 : 1,
              }}
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* Search Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search extensions in Marketplace..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 28px',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <a
            href="https://github.com/memuguenstig-lab/shadow-extensions"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: 'var(--accent-color)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 500,
            }}
          >
            <span>🌐 Publish Extension</span>
          </a>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--error-color)', color: 'var(--error-color)', fontSize: 11 }}>
          ⚠️ {error}
        </div>
      )}

      {/* List content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
            Loading extensions...
          </div>
        ) : (
          <>
            {installedList.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: '0 0 10px 2px' }}>
                  Installed ({installedList.length})
                </div>
                {installedList.map(renderExtensionRow)}
              </div>
            )}

            {recommendedList.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: '0 0 10px 2px' }}>
                  Marketplace
                </div>
                {recommendedList.map(renderExtensionRow)}
              </div>
            )}

            {allExtensions.length === 0 && (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <span>Nothing here yet.</span>
                <span>
                  Publish your extension{' '}
                  <a 
                    href="https://github.com/memuguenstig-lab/shadow-extensions" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}
                  >
                    here
                  </a>
                </span>
              </div>
            )}

            {allExtensions.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                No extensions found matching "{search}"
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExtensionsView;
