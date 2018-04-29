const MAX_AGE_CACHE_IN_MILLIS = 5 * 1000;

function run(searchText) {

    const configuration = getConfiguration();
    let jobs = fetchData(configuration);
    
    if (searchText == undefined) {
        return jobs.map(mapJobToItem);
    } else {
        return jobs
            .filter(onlyContaining(searchText))
            .map(mapJobToItem);
    }
}

function mapJobToItem({name, url, color, jobs}) {
    return {
        title: name,
        jenkinsUrl: url,
        icon: mapColorToIcon(color),
        children: jobs && jobs.map(mapJobToItem),
        action: "open",
        actionReturnsItems: !!jobs
    }
}

function onlyContaining(searchText) {
    const words = searchText.split(/[ -.]/);
    return (job) => words.every(w => job.name.includes(w));
}

function mapColorToIcon(color) {
    if (!color) {
        return "character:📔";
    } else if (color.includes("_anime")) {
        return "character:😅";
    } else {
        const mapping = {
            "red": "character:😡",
            "yellow": "character:🤕",
            "blue": "character:😄",
            "grey": "character:🤔",
            "disabled": "character:👻️",
            "aborted": "character:😵",
            "notbuilt": "character:🤔"
        }
        return mapping[color];
    }
}

function getConfiguration() {
    try {
        return File.readJSON("~/.jenkins-launchbar.json")
    } catch (e) {
        File.writeJSON({userId: null, apiKey: null, baseUrl: null}, "~/.jenkins-launchbar.json", {prettyPrint:true});
        LaunchBar.alert('Modify ~/.jenkins-launchbar.json to contain userId, apiKey and baseUrl');
    }
}

function fetchData(configuration) {
    let cache = null;
    if (File.exists("/tmp/jenkins-launchbar.cache")) {
        cache = File.readJSON("/tmp/jenkins-launchbar.cache");
    }

    if (isCacheUptoDate(cache)) {
        LaunchBar.debugLog("Using cache");
        return cache.jobs;
    } else {
        LaunchBar.debugLog("Fetching from network");
        const headerFields = {'Authorization':"Basic " + `${configuration.userId}:${configuration.apiKey}`.toBase64String()}
        let result = HTTP.getJSON(`${configuration.baseUrl}/api/json?pretty=true&tree=jobs[name,url,color,jobs[name,url,color]]`, {headerFields});
        let jobs = result.data.jobs;
        File.writeJSON({lastUpdated:new Date().getTime(), jobs}, "/tmp/jenkins-launchbar.cache", {prettyPrint:false});
        return jobs;
    }
}

function isCacheUptoDate(cache) {
    if (!cache) return false;
    const differenceInMillis = Math.abs(new Date().getTime() - cache.lastUpdated)
    return differenceInMillis < MAX_AGE_CACHE_IN_MILLIS;
}

function open(item) {
    if (LaunchBar.options.commandKey || !item.children) {
        LaunchBar.openURL(item.jenkinsUrl);
        return;
    }
    return item.children;
}