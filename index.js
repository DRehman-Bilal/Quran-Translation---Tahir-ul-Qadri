const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const async = require('async');

const infoUrl = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/info.json';
const baseUrl = 'https://irfan-ul-quran.com/english/Surah-';

const chapterNames = fs.readFileSync('surahs.txt', 'utf8').split('\n').filter(Boolean);

const startChapter = 56; 
const startVerse = 1;

request(infoUrl, (error, response, body) => {
  if (!error && response.statusCode === 200) {
    const info = JSON.parse(body);
    const chapters = info.chapters.slice(startChapter - 1); // Slice the chapters array from the desired chapter

    async.eachSeries(chapters, (chapterObj, chapterCallback) => {
      const chapter = chapterObj.chapter;
      const ayahCount = chapterObj.verses.length;
      const startAyah = chapter === startChapter ? startVerse : 1; // Start from the desired verse of the desired chapter

      async.eachSeries(Array.from({ length: ayahCount - startAyah + 1 }, (_, i) => i + startAyah), (ayah, ayahCallback) => {
        const url = `${baseUrl}${chapterNames[chapter - 1]}-with-english-translation/${ayah}`;
        const retryRequest = (attempt) => {
          request(url, (error, response, html) => {
            if (!error && response.statusCode === 200) {
              const $ = cheerio.load(html);
              const element = $(`.ur.dir-rtl`);
              const text = element.text().trim();

              const slicedText = text.substring(text.indexOf(".") + 2, text.length - 1);

              const dir = `irfan-ul-quran/${chapter}`;
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }

              const filename = `${ayah}.json`;
              const filepath = `${dir}/${filename}`;
              const obj = { text: slicedText };
              fs.writeFileSync(filepath, JSON.stringify(obj));
              console.log(`Chapter ${chapter}, Ayah ${ayah} saved to ${filepath}`);

              ayahCallback();
            } else {
              console.error(`Error on Chapter ${chapter}, Ayah ${ayah}, Attempt ${attempt}`, error);
              if (error.code === 'ETIMEDOUT') {
                retryRequest(attempt + 1);
              } else {
                ayahCallback(error);
              }
            }
          });
        };

        retryRequest(1);
      }, (err) => {
        if (err) {
          chapterCallback(err);
        } else {
          chapterCallback();
        }
      });
    }, (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log('All chapters and verses saved successfully!');
      }
    });
  }
});