module.exports = function(firebase) {
  const storage = firebase.storage();
  return {
    upload: blob => {
      var link;
      return storage.bucket().upload(blob.path).then(data => {
        let d = data[0];
        link = d.metadata.mediaLink;
        return d.makePublic();
      }).then(() => {
        return link;
      });
    },
    appendObjToFile: (localPath, bucketPath, obj) => {
      return storage.bucket().file(bucketPath).download({
        destination: localPath
      }).then(() => fsutil.readFromBuffer()).then(lines => {
        lines.push(JSON.stringify(obj));
        lines = lines.reduce((str, line) => str + line + "\n", "");
        return fsutil.writeToBuffer(lines);
      }).then(() => storage.bucket().file(bucketPath).upload(localPath));
    }
  }
}
