'use strict';
const express = require('express');
const simpleGit = require('simple-git');
const router = express.Router();

function git(dir) { return simpleGit(dir); }

// GET /git/branch — returns current branch for the active workspace
router.get('/branch', async (req, res) => {
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const cwd = req.query.dir || process.cwd();
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd });
    const branch = stdout.trim();
    res.json({ branch: branch || null });
  } catch(e) {
    res.json({ branch: null });
  }
});

router.post('/is-repo', async (req, res) => {
  try {
    const g = git(req.body.directory);
    const isRepo = await g.checkIsRepo();
    res.json({ isGitRepo: isRepo });
  } catch(e) { res.json({ isGitRepo: false }); }
});

router.post('/status', async (req, res) => {
  try {
    const status = await git(req.body.directory).status();
    res.json({ success: true, status });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/init', async (req, res) => {
  try {
    await git(req.body.directory).init();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/add', async (req, res) => {
  try {
    await git(req.body.directory).add(req.body.files);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/reset', async (req, res) => {
  try {
    await git(req.body.directory).reset(['HEAD', '--', ...req.body.files]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/commit', async (req, res) => {
  try {
    const result = await git(req.body.directory).commit(req.body.message);
    res.json({ success: true, result });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/log', async (req, res) => {
  try {
    const log = await git(req.body.directory).log({ maxCount: req.body.limit || 50 });
    res.json({ success: true, log: log.all });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/branches', async (req, res) => {
  try {
    const branches = await git(req.body.directory).branchLocal();
    res.json({ success: true, branches });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/check-identity', async (req, res) => {
  try {
    const g = git(req.body.directory);
    const name = await g.raw(['config','user.name']).catch(()=>'');
    const email = await g.raw(['config','user.email']).catch(()=>'');
    res.json({ success: true, name: name.trim(), email: email.trim() });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/set-identity', async (req, res) => {
  try {
    const g = git(req.body.directory);
    await g.addConfig('user.name', req.body.name);
    await g.addConfig('user.email', req.body.email);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/push', async (req, res) => {
  try {
    const result = await git(req.body.directory).push(req.body.remote || 'origin', req.body.branch || '');
    res.json({ success: true, result });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/stash-list', async (req, res) => {
  try {
    const list = await git(req.body.directory).stashList();
    res.json({ success: true, stashes: list.all });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/stash', async (req, res) => {
  try {
    const args = req.body.message ? ['push', '-m', req.body.message] : ['push'];
    await git(req.body.directory).stash(args);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/stash-apply', async (req, res) => {
  try {
    await git(req.body.directory).stash(['apply', `stash@{${req.body.stash_index}}`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/stash-pop', async (req, res) => {
  try {
    await git(req.body.directory).stash(['pop', `stash@{${req.body.stash_index || 0}}`]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/reset-hard', async (req, res) => {
  try {
    await git(req.body.directory).reset(['--hard', req.body.commit || 'HEAD']);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/reset-soft', async (req, res) => {
  try {
    await git(req.body.directory).reset(['--soft', req.body.commit || 'HEAD~1']);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/reset-mixed', async (req, res) => {
  try {
    await git(req.body.directory).reset(['--mixed', req.body.commit || 'HEAD~1']);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── File diff ──────────────────────────────────────────────────────────────

// Diff a single file (unstaged changes)
router.post('/diff-file', async (req, res) => {
  try {
    const { directory, filePath, staged } = req.body;
    const args = staged ? ['--cached', '--', filePath] : ['--', filePath];
    const diff = await git(directory).diff(args);
    res.json({ success: true, diff });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// Diff between two commits or refs
router.post('/diff-commits', async (req, res) => {
  try {
    const { directory, from, to, filePath } = req.body;
    const args = filePath ? [from, to, '--', filePath] : [from, to];
    const diff = await git(directory).diff(args);
    res.json({ success: true, diff });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get file content at a specific commit
router.post('/show-file', async (req, res) => {
  try {
    const { directory, commit, filePath } = req.body;
    const content = await git(directory).show([`${commit}:${filePath}`]);
    res.json({ success: true, content });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Remotes ────────────────────────────────────────────────────────────────

router.post('/remotes', async (req, res) => {
  try {
    const remotes = await git(req.body.directory).getRemotes(true);
    res.json({ success: true, remotes });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/remote-add', async (req, res) => {
  try {
    await git(req.body.directory).addRemote(req.body.name, req.body.url);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/remote-remove', async (req, res) => {
  try {
    await git(req.body.directory).removeRemote(req.body.name);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/fetch', async (req, res) => {
  try {
    await git(req.body.directory).fetch(req.body.remote || 'origin');
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/pull', async (req, res) => {
  try {
    const result = await git(req.body.directory).pull(req.body.remote || 'origin', req.body.branch || '');
    res.json({ success: true, result });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Branches (extended) ────────────────────────────────────────────────────

router.post('/branches-all', async (req, res) => {
  try {
    const local = await git(req.body.directory).branchLocal();
    const all = await git(req.body.directory).branch(['-a']);
    res.json({ success: true, local: local.all, current: local.current, all: all.all });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/branch-create', async (req, res) => {
  try {
    await git(req.body.directory).checkoutLocalBranch(req.body.name);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/branch-checkout', async (req, res) => {
  try {
    await git(req.body.directory).checkout(req.body.name);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/branch-delete', async (req, res) => {
  try {
    const flag = req.body.force ? '-D' : '-d';
    await git(req.body.directory).branch([flag, req.body.name]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/branch-rename', async (req, res) => {
  try {
    await git(req.body.directory).branch(['-m', req.body.oldName, req.body.newName]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/branch-merge', async (req, res) => {
  try {
    const result = await git(req.body.directory).merge([req.body.branch]);
    res.json({ success: true, result });
  } catch(e) {
    // Merge conflict — return conflict info
    res.status(409).json({ success: false, error: e.message, conflicts: true });
  }
});

// ── Tags ───────────────────────────────────────────────────────────────────

router.post('/tags', async (req, res) => {
  try {
    const tags = await git(req.body.directory).tags();
    res.json({ success: true, tags: tags.all });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/tag-create', async (req, res) => {
  try {
    const args = req.body.message
      ? ['-a', req.body.name, '-m', req.body.message]
      : [req.body.name];
    await git(req.body.directory).tag(args);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/tag-delete', async (req, res) => {
  try {
    await git(req.body.directory).tag(['-d', req.body.name]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Conflict detection ─────────────────────────────────────────────────────

router.post('/conflicts', async (req, res) => {
  try {
    const status = await git(req.body.directory).status();
    const conflicted = status.conflicted || [];
    res.json({ success: true, conflicted });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// Get the three versions of a conflicted file (ours/theirs/base)
router.post('/conflict-versions', async (req, res) => {
  try {
    const { directory, filePath } = req.body;
    const g = git(directory);
    const [ours, theirs, base] = await Promise.all([
      g.show([`:2:${filePath}`]).catch(() => ''),
      g.show([`:3:${filePath}`]).catch(() => ''),
      g.show([`:1:${filePath}`]).catch(() => ''),
    ]);
    res.json({ success: true, ours, theirs, base });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// Mark a conflict as resolved (git add)
router.post('/conflict-resolve', async (req, res) => {
  try {
    await git(req.body.directory).add(req.body.filePath);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Cherry-pick ────────────────────────────────────────────────────────────

router.post('/cherry-pick', async (req, res) => {
  try {
    await git(req.body.directory).raw(['cherry-pick', req.body.commit]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Blame ──────────────────────────────────────────────────────────────────

router.post('/blame', async (req, res) => {
  try {
    const { directory, filePath } = req.body;
    const raw = await git(directory).raw(['blame', '--porcelain', filePath]);
    // Parse porcelain blame output into lines
    const lines = [];
    const entries = raw.split('\n');
    let i = 0;
    while (i < entries.length) {
      const header = entries[i];
      if (!header || header.length < 40) { i++; continue; }
      const hash = header.slice(0, 40);
      const parts = header.slice(41).split(' ');
      const lineNum = parseInt(parts[1]);
      let author = '', date = '', summary = '';
      i++;
      while (i < entries.length && !entries[i].startsWith('\t')) {
        const l = entries[i];
        if (l.startsWith('author ')) author = l.slice(7);
        else if (l.startsWith('author-time ')) date = new Date(parseInt(l.slice(12)) * 1000).toLocaleDateString();
        else if (l.startsWith('summary ')) summary = l.slice(8);
        i++;
      }
      const content = entries[i] ? entries[i].slice(1) : '';
      lines.push({ hash, lineNum, author, date, summary, content });
      i++;
    }
    res.json({ success: true, lines });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Commit amend ───────────────────────────────────────────────────────────

router.post('/commit-amend', async (req, res) => {
  try {
    const args = req.body.message
      ? ['commit', '--amend', '-m', req.body.message]
      : ['commit', '--amend', '--no-edit'];
    await git(req.body.directory).raw(args);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Branch graph log ───────────────────────────────────────────────────────
// Returns commits with parent hashes, branch refs, and tags for graph rendering.
router.post('/log-graph', async (req, res) => {
  try {
    const { directory, limit = 80 } = req.body;
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    // Get current HEAD hash
    let headHash = '';
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: directory });
      headHash = stdout.trim();
    } catch (_) {}

    // Get all branch refs
    const { stdout: refOut } = await execFileAsync(
      'git', ['for-each-ref', '--format=%(objectname:short) %(refname:short)', 'refs/heads', 'refs/remotes'],
      { cwd: directory }
    ).catch(() => ({ stdout: '' }));
    const refMap = new Map(); // hash -> [branch names]
    for (const line of refOut.trim().split('\n')) {
      const [h, ...rest] = line.trim().split(' ');
      if (!h) continue;
      const name = rest.join(' ');
      if (!refMap.has(h)) refMap.set(h, []);
      refMap.get(h).push(name);
    }

    // Get all tag refs
    const { stdout: tagOut } = await execFileAsync(
      'git', ['for-each-ref', '--format=%(objectname:short) %(refname:short)', 'refs/tags'],
      { cwd: directory }
    ).catch(() => ({ stdout: '' }));
    const tagMap = new Map();
    for (const line of tagOut.trim().split('\n')) {
      const [h, ...rest] = line.trim().split(' ');
      if (!h) continue;
      const name = rest.join(' ').replace('refs/tags/', '');
      if (!tagMap.has(h)) tagMap.set(h, []);
      tagMap.get(h).push(name);
    }

    // Get log with parent hashes
    const fmt = '%H%x00%P%x00%s%x00%an%x00%ai%x1e';
    const { stdout: logOut } = await execFileAsync(
      'git', ['log', `--max-count=${limit}`, `--format=${fmt}`, '--all'],
      { cwd: directory }
    );

    const commits = [];
    for (const record of logOut.split('\x1e')) {
      const trimmed = record.trim();
      if (!trimmed) continue;
      const [hash, parentsRaw, message, author, date] = trimmed.split('\x00');
      if (!hash) continue;
      const parents = parentsRaw ? parentsRaw.trim().split(' ').filter(Boolean) : [];
      const shortHash = hash.slice(0, 7);
      // Match branch refs by short hash prefix
      const branches = [];
      for (const [h, names] of refMap) {
        if (hash.startsWith(h) || h.startsWith(hash.slice(0, 7))) branches.push(...names);
      }
      const tags = [];
      for (const [h, names] of tagMap) {
        if (hash.startsWith(h) || h.startsWith(hash.slice(0, 7))) tags.push(...names);
      }
      commits.push({
        hash, shortHash, parents, message: message?.trim() ?? '',
        author: author?.trim() ?? '', date: date?.trim() ?? '',
        branches, tags,
        isCurrent: hash === headHash,
      });
    }

    res.json({ success: true, commits });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── GPG Commit Signing ─────────────────────────────────────────────────────

router.post('/gpg-list-keys', async (req, res) => {
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('gpg', ['--list-secret-keys', '--keyid-format=long'], { timeout: 5000 });
    // Parse key IDs and UIDs
    const keys = [];
    const lines = stdout.split('\n');
    let currentKey = null;
    for (const line of lines) {
      if (line.startsWith('sec')) {
        const match = line.match(/\/([A-F0-9]{16})/i);
        if (match) currentKey = { id: match[1], uid: '' };
      } else if (line.startsWith('uid') && currentKey) {
        currentKey.uid = line.replace(/^uid\s+\[.*?\]\s+/, '').trim();
        keys.push({ ...currentKey });
        currentKey = null;
      }
    }
    res.json({ success: true, keys });
  } catch(e) { res.json({ success: false, keys: [], error: e.message }); }
});

router.post('/gpg-set-signing-key', async (req, res) => {
  try {
    const { directory, keyId, enable } = req.body;
    const g = git(directory);
    if (enable && keyId) {
      await g.addConfig('user.signingkey', keyId);
      await g.addConfig('commit.gpgsign', 'true');
    } else {
      await g.addConfig('commit.gpgsign', 'false');
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/gpg-get-config', async (req, res) => {
  try {
    const g = git(req.body.directory);
    const signingKey = await g.raw(['config', 'user.signingkey']).catch(() => '');
    const gpgSign = await g.raw(['config', 'commit.gpgsign']).catch(() => 'false');
    res.json({ success: true, signingKey: signingKey.trim(), gpgSign: gpgSign.trim() === 'true' });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Submodules ─────────────────────────────────────────────────────────────

router.post('/submodule-list', async (req, res) => {
  try {
    const result = await git(req.body.directory).subModule(['status']);
    const submodules = result.trim().split('\n').filter(Boolean).map(line => {
      const match = line.match(/^([+\- U]?)([a-f0-9]+)\s+(\S+)(?:\s+\((.+)\))?/);
      if (!match) return null;
      return { status: match[1].trim(), hash: match[2], path: match[3], branch: match[4] || '' };
    }).filter(Boolean);
    res.json({ success: true, submodules });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/submodule-add', async (req, res) => {
  try {
    const { directory, url, path: subPath } = req.body;
    await git(directory).submoduleAdd(url, subPath);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/submodule-update', async (req, res) => {
  try {
    const args = ['update', '--init', '--recursive'];
    if (req.body.path) args.push(req.body.path);
    await git(req.body.directory).subModule(args);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/submodule-remove', async (req, res) => {
  try {
    const { directory, path: subPath } = req.body;
    const g = git(directory);
    // Standard submodule removal sequence
    await g.raw(['submodule', 'deinit', '-f', subPath]);
    await g.raw(['rm', '-f', subPath]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Interactive Rebase ─────────────────────────────────────────────────────
router.post('/rebase-interactive', async (req, res) => {
  try {
    const { directory, base, script } = req.body;
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    // Write the rebase script to a temp file
    const tmpFile = path.join(os.tmpdir(), `shadowide-rebase-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, script, 'utf8');

    // Use GIT_SEQUENCE_EDITOR to inject our script
    const env = {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `cp "${tmpFile}"`,
    };

    await execFileAsync('git', ['rebase', '-i', base], { cwd: directory, env, timeout: 30000 });
    fs.unlinkSync(tmpFile);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Stash diff (preview before apply) ─────────────────────────────────────
router.post('/stash-diff', async (req, res) => {
  try {
    const { directory, stash_index = 0 } = req.body;
    const diff = await git(directory).diff([`stash@{${stash_index}}^!`]);
    res.json({ success: true, diff });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Commit full-text search ────────────────────────────────────────────────
router.post('/log-search', async (req, res) => {
  try {
    const { directory, query, limit = 50 } = req.body;
    const g = git(directory);
    // Search commit messages and diffs
    const log = await g.log([
      `--max-count=${limit}`,
      `--grep=${query}`,
      '--all',
      '--format=%H|%an|%ai|%s',
    ]);
    const results = log.all.map(c => ({
      hash: c.hash, author: c.author_name, date: c.date, message: c.message,
    }));
    res.json({ success: true, results });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── PR description generation (returns commits between branch and base) ────
router.post('/pr-commits', async (req, res) => {
  try {
    const { directory, base = 'main', head } = req.body;
    const g = git(directory);
    const currentBranch = head || (await g.branchLocal()).current;
    const log = await g.log([`${base}..${currentBranch}`, '--format=%H|%an|%s']);
    res.json({ success: true, commits: log.all, branch: currentBranch, base });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
