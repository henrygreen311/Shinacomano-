const fs = require('fs');
const { firefox } = require('playwright');
const path = require('path');

const scrape = async () => {
  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let captured = false;

  page.on('response', async (response) => {
    const requestUrl = response.url();

    if (
      requestUrl.includes('/api/virtuals/l/feeds/online/v1/categories/2/results/') &&
      !captured
    ) {
      captured = true;
      console.log('Intercepted:', requestUrl);

      try {
        const jsonResponse = await response.json();

        fs.writeFileSync('API.txt', requestUrl, 'utf-8');
        console.log('API URL saved to API.txt');

        const matches = jsonResponse.Results.filter(
          (match) => match.TournamentName === 'Week 19'
        );

        if (matches.length === 0) {
          console.log('No data found for "Week 19". Skipping data.json.');
          await browser.close();
          return;
        }

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

        const dataFilePath = path.resolve('data.json');
        let existingData = '';

        if (fs.existsSync(dataFilePath)) {
          existingData = fs.readFileSync(dataFilePath, 'utf-8').trim();
        }

        const combinedData = existingData
          ? `${existingData}\n\n${newEntries.join('\n\n')}`
          : newEntries.join('\n\n');

        fs.writeFileSync(dataFilePath, combinedData, 'utf-8');
        console.log('Appended new Week 19 data to data.json');
      } catch (err) {
        console.error('Error processing JSON response:', err);
      }

      await browser.close();
    }
  });

  try {
    await page.goto('https://m.betking.com/virtual/league/kings-league/results', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    console.log('Page navigation successful');
  } catch (err) {
    console.error('Page navigation failed:', err);
    await browser.close();
  }
};

// Main loop
(async () => {
  while (true) {
    console.log(`\n[${new Date().toISOString()}] Running scrape task...`);
    await scrape();
    console.log(`[${new Date().toISOString()}] Waiting 2 minutes...\n`);
    await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000)); // 2 minutes
  }
})();
