/**
 * Storage entry point for firebase-admin-util
 * @module storage
 */

const fs = require("fs");

module.exports = function(firebase) {

  const storage = firebase.storage();

  /**
   * Upload blob to storage bucket
   *
   * @async
   * @function
   * @param {Blob} blob - The blob you want to upload
   * @return {Promise<string>} Url of the uploaded blob
   */
  let upload = async blob => {
    let data = await storage.bucket().upload(blob.path);
    let d = data[0];
    var link = d.metadata.mediaLink;
    await d.makePublic();
    return link;
  }

  /**
   * Append object to file in bucket
   *
   * @async
   * @function
   * @param {string} localPath - The temporary path for the file
   * @param {string} bucketPath - The remote path for the file
   * @param {object} obj - The object you wish to append
   * @returns {Promise<string>} Content in the file after the append
   */
  let appendObjToFile = async(localPath, bucketPath, obj) => {
    let lines;
    try {
      await storage.bucket().file(bucketPath).download({
        destination: localPath
      });
      lines = fs.readFileSync(localPath, 'utf8').split("\n");
    } catch (e) {
      lines = [];
    }
    lines.push(JSON.stringify(obj));
    let content = lines.reduce((str, line) => str + line + "\n", "");
    fs.writeFileSync(localPath, content, 'utf8');
    await storage.bucket().upload(localPath, {
      destination: bucketPath
    });
    return content;
  }

  return {
    upload: upload,
    appendObjToFile: appendObjToFile
  }
}
