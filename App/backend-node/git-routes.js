'use strict';
const express = require('express');
const simpleGit = require('simple-git');
const router = express.Router();

function git(dir) { return simpleGit(dir); }

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

module.exports = router;
