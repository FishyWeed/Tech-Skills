// Screenshots pipeline: screens.json -> figures/<name>.png, one screenshot of each page of the built app, at the exact size.
// Usage: node <skill>/run.js screenshots   (the app must be running at the addresses in screens.json)
// A page behind a login: capture it with a browser tool that the user signs in to, and save it in figures/.
const path = require('path');

module.exports = {
  description: 'Screenshots of the pages of a running app from screens.json, at the exact size, into figures/',
  needs: 'Windows with Microsoft Edge (the picture size is cut with .NET System.Drawing)',
  data: ['screens.json'],
  run(ctx) {
    ctx.ps(path.join(__dirname, 'shoot.ps1'), ['-Source', ctx.source]);
  },
};
