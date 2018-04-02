# KadenceWebRTCDemo

## How to run:

1. `npm install`
2. replace node_module/@kadenceproject/kadence/package.json with kadence-browser-package.json and rename it to package.json (this is to disable two plugins that are not supported by browserify)
3. `npm run run-demo`

And then redirect browser to `localhost:8080/example/index.html`.

## Probable Issues With Your Installing:
You might face similar issues to me about complaints from `node-gyp`. If this happens, set your node python version to 2.7 (and change it back when you're done).

## Changes to package.json
For the time being, while this package is being developed, it's necessary to add this entry to the kadence package.json:
```
"browser": {
    "scrypt": false,
    "./lib/plugin-traverse.js": false
  },
```
This is the only difference applied in kadence-browser-package.json (at the time of writing) but imports may get updated.
