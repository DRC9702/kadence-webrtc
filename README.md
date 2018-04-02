# KadenceWebRTCDemo

## How to run:

1. `npm install`
2. replace node_module/@kadenceproject/kadence/package.json with kadence-browser-package.json and rename it to package.json (this is to disable two plugins that are not supported by browserify)
3. `npm run run-demo`

And then redirect browser to `localhost:8080/index.html`.

## Probable Issues With Your Installing:
You might face similar issues to me about complaints from `node-gyp`. If this happens, set your node python version to 2.7 (and change it back when you're done).
