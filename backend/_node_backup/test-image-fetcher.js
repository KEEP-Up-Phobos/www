/**
 * Test script to debug image fetching for sample data events
 */

const ImageFetcher = require('./lib/image-fetcher');

async function testImageFetching() {
  const fetcher = new ImageFetcher();

  // Test with sample data artists
  const testCases = [
    { eventName: "Gilberto Gil Live Show - São Paulo", artistName: "Gilberto Gil" },
    { eventName: "Wesley Safadão Live Show - Porto Alegre", artistName: "Wesley Safadão" },
    { eventName: "Pabllo Vittar Live Show - São Paulo", artistName: "Pabllo Vittar" }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: "${testCase.eventName}" by "${testCase.artistName}"`);
    try {
      const imageResult = await fetcher.fetchEventImage(testCase.artistName, testCase.eventName);
      if (imageResult) {
        const url = typeof imageResult === 'string' ? imageResult : imageResult.url;
        const src = typeof imageResult === 'object' ? imageResult.source : 'unknown';
        console.log(`✅ Found image (${src}): ${url}`);
      } else {
        console.log(`❌ No image found`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

if (require.main === module) {
  testImageFetching().catch(console.error);
}

module.exports = testImageFetching;