const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

console.log('📦 1. Committing fix to master branch...');
const masterStatus = execSync('git status -s', { encoding: 'utf8' }).trim();
if (masterStatus) {
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "fix: resolve ddaMult reference error in tick render loop"', { stdio: 'inherit' });
  execSync('git push origin master', { stdio: 'inherit' });
}

console.log('📦 2. Building Vite production bundle...');
execSync('node "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" run build', { stdio: 'inherit' });

console.log('🚀 3. Deploying production bundle to gh-pages...');
const tempDist = path.resolve('../.temp-dist-golf');
if (fs.existsSync(tempDist)) fs.rmSync(tempDist, { recursive: true, force: true });
copyFolderSync('dist', tempDist);

execSync('git checkout gh-pages', { stdio: 'inherit' });

// Copy compiled dist files into root of gh-pages
copyFolderSync(tempDist, '.');
fs.rmSync(tempDist, { recursive: true, force: true });

// Ensure public helper scripts are present
for (const f of ['arcade-sound-engine.js', 'arcade-difficulty.js', 'arcade-leaderboard.js']) {
  const srcFile = path.join('.', 'public', f);
  const destFile = path.join('.', f);
  if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
    fs.copyFileSync(srcFile, destFile);
  }
}

execSync('git add -A', { stdio: 'inherit' });
const ghStatus = execSync('git status -s', { encoding: 'utf8' }).trim();
if (ghStatus) {
  execSync('git commit -m "deploy: 🚀 fix ddaMult reference error and restore full 3D gameplay"', { stdio: 'inherit' });
  execSync('git push origin gh-pages', { stdio: 'inherit' });
}

execSync('git checkout master', { stdio: 'inherit' });
console.log('✅ Cute Mini Golf 3D master & gh-pages deployed successfully!');
