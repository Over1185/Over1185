#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/core');

const USERNAME = process.env.GITHUB_PROFILE_USERNAME || 'Over1185';
const TOKEN = process.env.GITHUB_TOKEN;
const REPOS_LIMIT = parseInt(process.env.RECENT_REPOS_LIMIT || '5', 10);

const octokit = new Octokit({
  auth: TOKEN,
  userAgent: 'profile-readme-updater'
});

async function fetchRecentRepos() {
  const perPage = 100;
  const res = await octokit.request('GET /users/{username}/repos', {
    username: USERNAME,
    sort: 'updated',
    direction: 'desc',
    per_page: perPage
  });

  const repos = res.data
    .filter(r => !r.fork)
    .filter(r => r.name.toLowerCase() !== USERNAME.toLowerCase()) // exclude profile repo
    .slice(0, REPOS_LIMIT)
    .map(r => ({
      name: r.name,
      html_url: r.html_url,
      description: r.description || '',
      stargazers_count: r.stargazers_count,
      pushed_at: r.pushed_at
    }));

  return repos;
}

function formatDate(iso) {
  return iso ? iso.substring(0, 10) : '';
}

function buildEnglishList(repos) {
  if (!repos.length) {
    return '_No recent repositories found._';
  }
  return repos
    .map(r => {
      const desc = r.description ? ` — ${r.description}` : '';
      return `- [${r.name}](${r.html_url})${desc} ⭐ ${r.stargazers_count} (updated ${formatDate(r.pushed_at)})`;
    })
    .join('\n');
}

function buildSpanishList(repos) {
  if (!repos.length) {
    return '_No se encontraron repositorios recientes._';
  }
  return repos
    .map(r => {
      const desc = r.description ? ` — ${r.description}` : '';
      return `- [${r.name}](${r.html_url})${desc} ⭐ ${r.stargazers_count} (actualizado ${formatDate(r.pushed_at)})`;
    })
    .join('\n');
}

function replaceSection(content, startMarker, endMarker, newBody) {
  const pattern = new RegExp(
    `${startMarker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[\\s\\S]*?${endMarker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`
  );
  return content.replace(pattern, `${startMarker}\n${newBody}\n${endMarker}`);
}

async function run() {
  try {
    const repos = await fetchRecentRepos();
    const englishList = buildEnglishList(repos);
    const spanishList = buildSpanishList(repos);
    const nowIso = new Date().toISOString();
    const englishTimestamp = `Last updated: ${nowIso}`;
    const spanishTimestamp = `Última actualización: ${nowIso}`;

    const root = process.cwd();
    const readmePath = path.join(root, 'README.md');
    const readmeEsPath = path.join(root, 'README.es.md');

    const filesToUpdate = [
      {
        path: readmePath,
        replacements: [
          {
            start: '<!--RECENT_REPOS:START-->',
            end: '<!--RECENT_REPOS:END-->',
            body: englishList
          },
            {
            start: '<!--LAST_UPDATE:START-->',
            end: '<!--LAST_UPDATE:END-->',
            body: englishTimestamp
          }
        ]
      },
      {
        path: readmeEsPath,
        replacements: [
          {
            start: '<!--ULTIMOS_REPOS:INICIO-->',
            end: '<!--ULTIMOS_REPOS:FIN-->',
            body: spanishList
          },
          {
            start: '<!--ULTIMA_ACTUALIZACION:INICIO-->',
            end: '<!--ULTIMA_ACTUALIZACION:FIN-->',
            body: spanishTimestamp
          }
        ]
      }
    ];

    let changed = false;

    for (const file of filesToUpdate) {
      if (!fs.existsSync(file.path)) {
        console.warn(`File not found (skipping): ${file.path}`);
        continue;
      }
      let content = fs.readFileSync(file.path, 'utf8');
      const original = content;

      file.replacements.forEach(rep => {
        if (!content.includes(rep.start) || !content.includes(rep.end)) {
          console.warn(`Markers missing in ${file.path}: ${rep.start} / ${rep.end}`);
          return;
        }
        content = replaceSection(content, rep.start, rep.end, rep.body);
      });

      if (content !== original) {
        fs.writeFileSync(file.path, content, 'utf8');
        console.log(`Updated: ${file.path}`);
        changed = true;
      } else {
        console.log(`No changes for: ${file.path}`);
      }
    }

    if (!changed) {
      console.log('No file changes detected.');
      return;
    }

  } catch (err) {
    console.error('Error updating README files:', err);
    process.exit(1);
  }
}

run();