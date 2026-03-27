async function test() {
  const res = await fetch('https://maili-news-scrapper.chihhe.dev/api/v1/parishes/nearby?lat=25.0478&lng=121.5170&radius=10&limit=20', {
    headers: { 'Accept': 'application/json' }
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
test();
