const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { firefox } = require('playwright');

const API_FILE = 'API.txt';
const DATA_FILE = 'data.json';
const TARGET_WEEK = 'Week 10';

const runGitCommands = (message) => {
  try {
    execSync('git config user.email "automation@company.com"', { stdio: 'inherit' });
    execSync('git config user.name "Automation Bot"', { stdio: 'inherit' });

    execSync(`git add ${DATA_FILE} ${API_FILE}`, { stdio: 'inherit' });
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' });

    const repoUrl = 'https://github.com/henrygreen311/Shinacomano-.git';
    const authUrl = `https://${process.env.PAT_TOKEN}@${repoUrl.replace(/^https:\/\//, '')}`;
    execSync(`git remote set-url origin ${authUrl}`, { stdio: 'inherit' });

    execSync('git push', { stdio: 'inherit' });
    console.log(`${DATA_FILE} and ${API_FILE} successfully pushed to GitHub`);
  } catch (error) {
    if (error.message.includes('nothing to commit')) {
      console.log('No changes to commit.');
    } else {
      console.error('Git push failed:', error.message);
    }
  }
};

(async () => {
  const scrape = async () => {
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let captured = false;

    page.on('response', async (response) => {
      const requestUrl = response.url();

      if (
        requestUrl.includes('/api/virtuals/l/feeds/online/v1/categories/2/results/') &&
        !captured
      ) {
        try {
          const jsonResponse = await response.json();
          const matches = jsonResponse.Results.filter(
            (match) => match.TournamentName === TARGET_WEEK
          );

          if (matches.length === 0) {
            console.log(`No "${TARGET_WEEK}" found in response. Skipping.`);
            return;
          }

          // Capture only if Week 19 exists
          captured = true;

          const previousUrl = fs.existsSync(API_FILE) ? fs.readFileSync(API_FILE, 'utf-8').trim() : '';
          if (requestUrl === previousUrl) {
            console.log('API URL already processed, skipping.');
            return;
          }

          // Save new API URL
          fs.writeFileSync(API_FILE, requestUrl, 'utf-8');
          console.log('API URL saved to API.txt:', requestUrl);

          const newEntries = matches.map((match) => {
            const leg = match.TournamentLeg;
            const dayno = match.TournamentDayNo;
            const leagueno = match.TournamentLeagueNo;
            const tourid = match.TournamentID;
            const matchid = match.MatchID;
            const matchdate = match.MatchDate;
            const teams = match.MatchName;
            const scores = `${match.HomeTeam.TeamScore} - ${match.AwayTeam.TeamScore}`;

            return `leg: ${leg}, dayno:${dayno}, leagueno: ${leagueno}, tourid: ${tourid}\nmatchid:${matchid},matchdate: ${matchdate}\nteams: ${teams}\nScores: ${scores}`;
          });

          const dataFilePath = path.resolve(DATA_FILE);
          let existingData = '';

          if (fs.existsSync(dataFilePath)) {
            existingData = fs.readFileSync(dataFilePath, 'utf-8').trim();
          }

          const combinedData = existingData
            ? `${existingData}\n\n${newEntries.join('\n\n')}`
            : newEntries.join('\n\n');

          fs.writeFileSync(dataFilePath, combinedData, 'utf-8');
          //console.log(`Appended new ${TARGET_WEEK} data to ${DATA_FILE}`);

          const commitMessage = `Update data.json at ${new Date().toISOString()}`;
          runGitCommands(commitMessage);
        } catch (err) {
          console.error('Error processing response:', err.message);
        } finally {
          await browser.close();
        }
      }
    });

    try {
      await page.goto('https://m.betking.com/virtual/league/kings-league/results', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      //console.log('Page navigation successful');
    } catch (err) {
      console.error('Page navigation failed:', err.message);
      await browser.close();
    }
  };

  // Run every 30 minutes
  while (true) {
    //console.log(`\n[${new Date().toISOString()}] Running scrape task...`);
    await scrape();
    //console.log(`[${new Date().toISOString()}] Waiting 30 minutes...\n`);
    await new Promise((resolve) => setTimeout(resolve, 30 * 60 * 1000));
  }
})();
