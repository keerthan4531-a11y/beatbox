async function test() {
  const query = 'anirudh';
  const urls = [
    `https://jiosaavn-api-2.vercel.app/search/songs?query=${query}`,
    `https://jiosaavn-api-2.vercel.app/search/albums?query=${query}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      console.log(`URL: ${url}`);
      console.log(JSON.stringify(json, null, 2).substring(0, 500) + '...');
    } catch (e) {
      console.log(`ERROR: ${e.message} - ${url}`);
    }
  }
}
test();
