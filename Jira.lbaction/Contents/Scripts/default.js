const MAX_AGE_CACHE_IN_MILLIS = 1000;
const SETTINGS_FILE_PATH = "~/.jira-launchbar.json";
const CACHE_FILE_PATH = "/tmp/jira-launchbar.cache";
const JIRA_KEY_REGEX = /^[a-zA-Z]+-[0-9]+$/;

function run(searchText) {
    const configuration = getConfiguration();
    
    if (searchText == undefined) {
        let issues = fetchData(configuration);
        return issues.map(mapIssueToItem);
    } else {
        let issues = fetchData(configuration, searchText);
        return issues
            .filter(onlyContaining(searchText))
            .map(mapIssueToItem);
    }
}

function mapIssueToItem(issue) {
    return {
        title: issue.fields.summary,
        subtitle: mapToSubitle(issue.key, issue.fields),
        alwaysShowsSubtitle: true,
        icon: mapToIcon(issue.fields.status.name),
        action: "open",
        actionArgument: issue,
        actionReturnsItem: true
    }
}

function mapToIcon(status) {
    switch (status) {
        case "Open": return "character:😪";
        case "In Progress": return "character:😅";
        case "Review": return "character:🤓";
        case "Closed":
        case "Done": return "character:🤗"
        default: return "character:😶";
    }
}

function mapToSubitle(key, fields) {
    let type = fields.issuetype.name === "Bug" ? "🐞" : "";
    let assignee = fields.assignee ? `- ${fields.assignee.displayName}` : "";
    return `${type} ${key} - ${fields.status.name} ${assignee}`
}

function onlyContaining(searchText) {
    const words = searchText.split(/[ -.]/);
    return (issue) => words.every(w => {
        let body = `${issue.key} ${issue.fields.summary}`
        return body.toLowerCase().includes(w.toLowerCase())
    });
}

function getConfiguration() {
    try {
        return File.readJSON(SETTINGS_FILE_PATH)
    } catch (e) {
        File.writeJSON({user: null, password: null, baseUrl: null, jql: null}, SETTINGS_FILE_PATH, {prettyPrint:true});
        LaunchBar.alert(`Modify ${SETTINGS_FILE_PATH} to contain userId, password, baseUrl and jql`);
    }
}

function fetchData(configuration, searchText) {
    let cache = null;
    if (File.exists(CACHE_FILE_PATH)) {
        cache = File.readJSON(CACHE_FILE_PATH);
    }

    if (isCacheUptoDate(cache, searchText)) {
        LaunchBar.debugLog("Using cache");
        return cache.issues;
    } else {
        LaunchBar.debugLog("Fetching from network");
        const headerFields = {'Authorization':"Basic " + `${configuration.user}:${configuration.password}`.toBase64String()}
        const jqlForUrl = getJql(configuration, searchText);
        let result = HTTP.getJSON(`${configuration.baseUrl}/rest/api/2/search?jql=${jqlForUrl}&fields=key,self,summary,status,issuetype,assignee,project`, {headerFields});
        let issues = result.data.issues;
        File.writeJSON({
            lastUpdated:new Date().getTime(), 
            issues,
            searchText
        }, CACHE_FILE_PATH, {prettyPrint:false});
        return issues;
    }
}

function getJql(configuration, searchText) {
    if (searchText && searchText.trim().match(JIRA_KEY_REGEX)) {
        return encodeURIComponent(`key=${searchText}`);
    } else {
        return encodeURIComponent(configuration.jql);
    }
}

function isCacheUptoDate(cache, searchText) {
    if (!cache) return false;
    const differenceInMillis = Math.abs(new Date().getTime() - cache.lastUpdated)
    return differenceInMillis < MAX_AGE_CACHE_IN_MILLIS && neitherHaveSearchText(cache,searchText);
}

function neitherHaveSearchText(cache, searchText) {
    return !cache.searchText && !searchText;
}

function open(issue) {
    const configuration = getConfiguration();
    
    if (LaunchBar.options.commandKey) {
        LaunchBar.openURL(`${configuration.baseUrl}/browse/${issue.key}`);
        return;
    } else if (LaunchBar.options.alternateKey) {
        LaunchBar.paste(issue.key);
        return;
    }

    const branchNamePrefix = issue.fields.issuetype.name === "Bug" ? "bugfix" : "feature";

    return [
        {title: issue.key},
        {title: issue.fields.summary},
        {title: `${branchNamePrefix}-${issue.key}-${LaunchBar.userName}-`},
        {title: "Detail", url: `${configuration.baseUrl}/browse/${issue.key}`},
        {title: "Project", url: `${configuration.baseUrl}/browse/${issue.fields.project.key}`},
    ];   
}

