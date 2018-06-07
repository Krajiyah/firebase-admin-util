# firebase-admin-util

## Documentation
http://krajiyah.github.io/firebase-admin-util

## Notes
1. schema must be in following format:
```json
{
  "User": {
      "path": "Users",
      "fields": {
        "name": "string",
        "image": "link",
        "age": "number",
        "isAdmin": "boolean",
        "meta": "object",
        "dogs": "array:Dogs",
        "cat": "string:Cats"
      }
  },
  "Dog": {
    "path": "SomeNode/SomeNode/Dogs",
    "fields": {
      "name": "string",
      "user": "string:Users"
    }
  },
  "Cat": {
    "path": "SomeNode/Cats",
    "fields": {
      "name": "string",
      "user": "string:Users"
    }
  }
}
```

2. Example usage:
```js
const User = require("firebase-admin-util")(firebase, schema).User;
User.getByKey("some key").then(function(user) {
  // do stuff with User object fetched
});
```
