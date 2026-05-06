const urls = [
  'https://jiosaavn-api.vercel.app/search/all?query=mersel',
  'https://saavn.me/api/search/all?query=mersel',
  'https://saavn-api.vercel.app/search/all?query=mersel',
  'https://saavn.dev/api/search/songs?query=mersel',
  'https://jiosaavn-api-sigma-six.vercel.app/search/all?query=mersel',
  'https://jiosaavn-api-privatecvc2.vercel.app/search/all?query=mersel',
  'https://jiosaavn-api-tau.vercel.app/search/all?query=mersel',
  'https://jiosaavn-api-sam.vercel.app/search/all?query=mersel'
];

async function test() {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text.includes('status') || text.includes('success') || text.includes('data')) {
        console.log('SUCCESS:', url);
      } else {
        console.log('FAIL (Not JSON):', url, text.substring(0, 50));
      }
    } catch (e) {
      console.log('FAIL (Error):', url, e.message);
    }
  }
}
test();
