const MAX_AGE_CACHE_IN_MILLIS = 5 * 60 * 1000;
const SETTINGS_FILE_PATH = "~/.bitbucket-launchbar.json";
const CACHE_FILE_PATH = "/tmp/bitbucket-launchbar.cache";

function run(searchText) {

    const configuration = getConfiguration();
    let repos = fetchData(configuration);
    
    if (searchText == undefined) {
        return repos.map(mapRepoToItem);
    } else {
        return repos
            .filter(onlyContaining(searchText))
            .map(mapRepoToItem);
    }
}

function mapRepoToItem({name, project, links}) {
    return {
        title: name,
        badge: project.key,
        icon: "character:📦",
        action: "open",
        actionArgument: links
    }
}

function onlyContaining(searchText) {
    const words = searchText.split(/[ -.]/);
    return (repo) => words.every(w => repo.name.includes(w) || repo.project.key.toLowerCase().includes(w));
}

function getConfiguration() {
    try {
        return File.readJSON(SETTINGS_FILE_PATH)
    } catch (e) {
        File.writeJSON({user: null, password: null, baseUrl: null}, SETTINGS_FILE_PATH, {prettyPrint:true});
        LaunchBar.alert(`Modify ${SETTINGS_FILE_PATH} to contain userId, password and baseUrl`);
    }
}

function fetchData(configuration) {
    let cache = null;
    if (File.exists(CACHE_FILE_PATH)) {
        cache = File.readJSON(CACHE_FILE_PATH);
    }

    if (isCacheUptoDate(cache)) {
        LaunchBar.debugLog("Using cache");
        return cache.values;
    } else {
        LaunchBar.debugLog("Fetching from network");
        const headerFields = {'Authorization':"Basic " + `${configuration.user}:${configuration.password}`.toBase64String()}
        let result = HTTP.getJSON(`${configuration.baseUrl}/rest/api/1.0/repos?limit=500`, {headerFields});
        let values = result.data.values;
        File.writeJSON({lastUpdated:new Date().getTime(), values}, CACHE_FILE_PATH, {prettyPrint:false});
        return values;
    }
}

function isCacheUptoDate(cache) {
    if (!cache) return false;
    const differenceInMillis = Math.abs(new Date().getTime() - cache.lastUpdated)
    return differenceInMillis < MAX_AGE_CACHE_IN_MILLIS;
}

function open(links) {
    const clones = links.clone.map(u => {return {url:u.href, label: u.name}});
    
    if (LaunchBar.options.commandKey) {
        LaunchBar.openURL(links.self[0].href);
        return;
    } else if (LaunchBar.options.alternateKey) {
        LaunchBar.paste(clones.find(n => "ssh" === n.label).url)
        return;
    }
    return [
        {url:links.self[0].href, label:"home" },
        ...clones
    ];   
}