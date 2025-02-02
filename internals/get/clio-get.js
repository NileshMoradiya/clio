const decompress = require('decompress');
const tmp = require('tmp');
const fs = require('fs');
const fetch = require("node-fetch");
const { updatePackageJsonDependencies, getClioDependencies } = require("../helpers/package")

const gitHubRegex = /github\.com\/(\w|\d|_|-).+\/(\d|\w|-|_).+/gi;
const versionRegex = /@(\d\.?){1,3}$/gi;

/**
 * @method get
 * @param {string} argv
 * @returns {void}
 * @description Installs a Clio dependency
 */

function get(argv) {
  const url = argv.url;
  return url.match(gitHubRegex).length 
         ? fetchGitHub(url)
         : fetchFile(url)
}

async function fetchFile(argv) {
  try {
    const url = argv.url;
    const file = await fetch(url);
    const array_buffer = await file.arrayBuffer();
    const buffer = Buffer.from(array_buffer);
    const tmpobj = tmp.fileSync();
    fs.writeFileSync(tmpobj.name, buffer, 'binary');
    await decompress(tmpobj.name, 'clio_env')
    tmpobj.removeCallback();
  } catch (err) {
    console.log(err)
  }
}

/**
 * @method fetchGitHub
 * @param {string} argv
 * @returns {void}
 * @description Fetches a library from GitHub and saves
 *              the dependency reference into the Package.json file.
 */

async function fetchGitHub(argv) {
  /**
   * Check if required package exposes a specific
   * version or not.
   * Specific version must be exposed the following way:
   * 
   * $ clio get github.com/foo/bar@1.2.3
   * 
   * Specific version has to be downloaded in the following format:
   * 
   *  https://github.com/foo/bar/archive/1.2.3.zip
   * 
   * If no version is specified, download from master branch:
   * 
   * https://github.com/foo/bar/archive/master.zip
   *
   */
  const packageTarget = hasVersion(argv) 
                      ? getVersion(argv).replace("@", "")
                      : "master";

  const packageUri = hasVersion(argv)
                   ? argv.replace(versionRegex, "")
                   : argv

  /**
   * So now let's create a download uri that will look as follows:
   * 
   * https://github.com/archive/foo/bar/{master|@1.2.3}.zip
   */
  const fetchUrl = `https://${packageUri}/archive/${packageTarget}.zip`;
  
  console.log(`Downloading ${argv}...`);
  fetchFile({url: fetchUrl});

  /**
   * If the dependency is already listed in package.json
   * don't update it.
   */
  if (!getClioDependencies().includes(argv)) {
    updatePackageJsonDependencies(argv)
      .then(() => console.log(`Added ${argv} to the dependencies list`))
      .catch((err) => console.log(`Can not add ${argv} to the dependencies list`, err))
  }

}

/**
 * @method getVersion
 * @param {string} argv
 * @returns {string}
 * @description Gets the version number (if any) of the
 *              desidered dependency.
 */

function getVersion(argv) {
  const matches = argv.match(versionRegex)
  return matches 
       ? matches[0] 
       : ""
}

/**
 * @method hasVersion
 * @param {string} argv
 * @returns {boolean}
 * @description Returns true when the desidered dependency
 *              specifies a version.
 */

function hasVersion(argv) {
  return !!getVersion(argv).length
}

module.exports = {
  get,
  hasVersion,
  getVersion
}