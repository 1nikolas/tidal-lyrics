const { app, BrowserWindow, Menu, ipcMain, dialog, nativeImage, globalShortcut } = require('electron');
const fs = require("fs");
const remote = require("electron").remote;
const path = require('path');
const { exec } = require("child_process");
var request = require("request");
var currentSong = "---";
var hasRetried = false;
var hasRetried2 = false;
var isCommandRunning = false;
var logPath = app.getPath("logs") + "/app.log"


if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 380,
        height: 600,
        minWidth: 380,
        minHeight: 600,
        maxWidth: 380,
        //maxHeight: 600,
        frame: false,
        resizable: true,
        icon: __dirname + '/images/icon.png',
        webPreferences: {
            nodeIntegration: true,
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.webContents.on('did-finish-load', function () {
        if (process.platform == "darwin") {
            mainWindow.webContents.send('setMacCloseSymbol')
        }
    })

    if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath)
    }

    appLog('Version: ' + app.getVersion())

    request({ uri: "https://raw.githubusercontent.com/1nikolas/tidal-lyrics/master/version.txt" },
        function (error, response, body) {
            if (error == null) {
                if (!body.includes(app.getVersion())) {
                    //update available
                    var dialogIcon = null
                    if (process.platform == "darwin") {
                        dialogIcon = __dirname + "/images/icon.png"
                    }
                    dialog.showMessageBox(mainWindow, {
                        type: "info",
                        buttons: ["Update", "Dismiss"],
                        message: "An update is available!",
                        icon: dialogIcon,
                        cancelId: 1
                    }).then(result => {
                        if (result.response === 0) {
                            require('electron').shell.openExternal("https://github.com/1nikolas/tidal-lyrics/releases");
                            if (process.platform == "win32") {
                                app.quit()
                            } else if (process.platform == "darwin") {
                                setTimeout(app.quit(), 1000);
                            }
                        }
                    })

                }
            }
        }
    )

    //for debugging purposes
    globalShortcut.registerAll(["CommandOrControl+Alt+Shift+D"], () => {
        if (mainWindow.isFocused) {
            mainWindow.webContents.openDevTools();
        }
    });


    Menu.setApplicationMenu(null)

    mainWindow.webContents.on('new-window', function (e, url) {
        e.preventDefault();
        require('electron').shell.openExternal(url);
    });

    setInterval(function () {
        getSongInfo();
    }, 1000)


    ipcMain.on("closeButtonEvent", function (event) {
        app.quit();
    });

    ipcMain.on("minButtonEvent", function (event) {
        BrowserWindow.getFocusedWindow().minimize();
        event.sender.send("btnclick-task-finished", "yes");
    });

    ipcMain.on("refreshBtnEvent", function (event) {
        getSongInfo(true);
    });

    ipcMain.on("aboutBtnEvent", function (event) {

        dialog.showMessageBox(mainWindow, {
            buttons: ["OK", "Visit tidal-lyrics on Github", "View Logs"],
            message: "tidal-lyrics " + app.getVersion() + "\nMade by Nikolas Spiridakis",
            icon: __dirname + "/images/icon.png"
        }).then(result => {
            if (result.response === 1) {
                require('electron').shell.openExternal("https://github.com/1nikolas/tidal-lyrics/");
            } else if (result.response === 2) {
                if (process.platform == "win32") {
                    require('electron').shell.openExternal(logPath)
                } else if (process.platform == "darwin") {
                    exec("open -t " + logPath)
                }

            }
        })

    });



};

if (process.platform == "darwin") {
    app.dock.setIcon(nativeImage.createFromPath(__dirname + "/images/icon.png"));
}

app.on('ready', createWindow);

// For MacOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// For MacOS
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});



function getSongInfo(force = false) {

    if (!isCommandRunning) {
        if (process.platform == "win32") {
            getSongInfoWin(force)
        } else if (process.platform == "darwin") {
            getSongInfoMac(force)
        }
    }


}

function getSongInfoWin(force) {

    isCommandRunning = true

    exec("powershell -ExecutionPolicy Bypass -File \"" + __dirname + "\\scripts\\windows.ps1\"", (error, stdout, stderr) => {

        isCommandRunning = false

        var commandOut = stdout.trim()

        if (stderr){
            appLog('Powershell stderr: ' + stderr)
        }

        if ((currentSong != commandOut || force) && commandOut != "Drag" && commandOut != "") {

            currentSong = commandOut;

            if (commandOut.includes("Cannot find a process with the name")) {
                //tidal not running
                appLog("State: Not running")
                setLyrics("", "Tidal is not running.")
            } else if (commandOut == "TIDAL") {
                //tidal is paused
                appLog("State: Paused")
                setLyrics("", "Tidal is paused.")
            } else if (commandOut.includes(" - ")) {
                //tidal is playing music
                appLog('\n-------------------------------\n')
                appLog('State: Playing ' + commandOut)

                //Replace / with * is used because Musixmatch doesn't like slashes in the search query
                //Replace " - " with "* - " is used because Tidal sometimes ommits parentheses in the end of a title when it outputs the window title to save up space

                searchQuery = commandOut.replace(" - ", "* - ").replace("/", "*")
                setLyrics("", "Loading...")
                searchMusixmatch(searchQuery)
            } else {
                //script failed (probably)
                appLog("Error: " + commandOut)
                setLyrics("", "Error:<br>" + commandOut)

            }
        }

    });


}

function getSongInfoMac(force) {

    isCommandRunning = true

    exec("/bin/bash " + __dirname + "/scripts/macos.sh " + __dirname + "/scripts/macos.scpt", (error, stdout, stderr) => {

        isCommandRunning = false

        var commandOut = stdout.trim()

        if ((currentSong != commandOut || force) && commandOut != "Drag" && commandOut != "") {

            currentSong = commandOut

            if (commandOut == "noEventsPerm") {
                //System Events.App permission not granted
                currentSong = "noEventsPerm"
                appLog("System Events.App permission not granted")
                setLyrics("", 'Please grant System Events.App permission<br><br>If the permission dialog didn\'t come up you have to grant it manually:<br>1. Go to Settings<br>2. Security & Privacy<br>3. Go to Privacy Tab<br>4. Choose Automation<br>5. Under tidal-lyrics tick "System Events.App"<br><br>(Blame Apple for all this)')
            } else if (commandOut == "noAccessibilityPerm") {
                //Accessibility permission not granted
                currentSong = "noAccessibilityPerm"
                appLog("Accessibility permission not granted")
                setLyrics("", 'Please grant Accessibility permission<br><br>If the permission dialog didn\'t come up you have to grant it manually:<br>1. Go to Settings<br>2. Security & Privacy<br>3. Go to Privacy Tab<br>4. Choose Accecibility<br>5. Click the lock icon on the bottom left and enter your password<br>6. Tick tidal-lyrics<br><br>(Blame Apple for all this)')
            } else if (commandOut == "notRunning") {
                //Tidal not running
                currentSong = "notRunning"
                appLog("State: Not running")
                setLyrics("", "Tidal is not running.")
            } else if (commandOut == "TIDAL") {
                //Tidal is paused
                currentSong = "TIDAL"
                appLog("State: Paused")
                setLyrics("", "Tidal is paused.")
            } else if (commandOut.includes(" - ")) {
                //Tidal is playing
                currentSong = commandOut
                appLog('\n-------------------------------\n')
                appLog('State: Playing ' + commandOut)

                //Replace / with * is used because Musixmatch doesn't like slashes in the search query
                //Replace " - " with "* - " is used because Tidal sometimes ommits parentheses in the end of a title when it outputs the window title to save up space

                searchQuery = commandOut.replace(" - ", "* - ").replace("/", "*")
                setLyrics("", "Loading...")
                searchMusixmatch(searchQuery)
            } else if (commandOut != "Drag") {
                //script failed (probably)
                appLog("Error: " + stdout)
                setLyrics("", "Error:<br>" + stdout)
            }


        }

    })


}


function searchMusixmatch(searchQuery, oldSearchQuery = "") {
    request({ uri: "https://www.musixmatch.com/search/" + encodeURIComponent(searchQuery).replace("%26", "&").replace("%2B", "+") },
        function (error, response, body) {
            appLog("Search URL: https://www.musixmatch.com/search/" + encodeURIComponent(searchQuery).replace("%26", "&").replace("%2B", "+"))
            if (error != null) {
                //error
                appLog('Search Failed (Internet Error?)')
                setLyrics("", "Error (No Internet?)<br>Try clicking refresh")

            } else if (!body.includes("Best Result")) {

                if (!hasRetried && searchQuery.includes(', ')) {

                    //This is used to retry if it can't find a song due to being on Musixmatch as "Song (feat. ArtistB) - ArtistA" rather than "Song - ArtistA, ArtistB"
                    //It basically keeps only the first artist

                    hasRetried = true;

                    var splitedQuery = searchQuery.split(' - ')
                    var originalArtists = splitedQuery[splitedQuery.length - 1]
                    var firstArtist = originalArtists.substring(0, originalArtists.indexOf(', '))

                    var newSearchQuery = searchQuery.replace(originalArtists, firstArtist)

                    searchMusixmatch(newSearchQuery, searchQuery)


                } else if (!hasRetried2 && ((searchQuery.includes(' (') || oldSearchQuery.includes(' (')) || (searchQuery.includes(' [') || oldSearchQuery.includes(' [')))) {

                    //This is used to retry if it can't find a song due to being on Musixmatch without parenthesis/brackets postfixes (see issue #6 for more details)
                    //It removes the paremtheses/brackets from the song title

                    hasRetried2 = true;

                    var queryToUse = ""
                    if (oldSearchQuery == "") {
                        queryToUse = searchQuery
                    } else {
                        queryToUse = oldSearchQuery
                    }

                    var splitedQuery = queryToUse.split(' - ')
                    var originalSongName = splitedQuery[0]

                    var newSongName = originalSongName.replace(/\(([^)]+)\)/, '').replace(' *', '*').replace(/\[([^\]]+)]/, '').replace(' *', '*')

                    var newSearchQuery = queryToUse.replace(originalSongName, newSongName)

                    searchMusixmatch(newSearchQuery, queryToUse)


                } else {

                    //This is used because Musixmatch search is a bit borken sometimes and some songs only appear on the tracks tab (not in all results)
                    if (oldSearchQuery == "") {
                        oldSearchQuery = searchQuery
                    }

                    searchMusixmatchSlashTracks(oldSearchQuery)

                }
            } else {

                var lyricsUrl = body.substring(
                    body.indexOf('"track_share_url":"') + 19,
                    body.indexOf('?utm_source=application')
                );

                appLog('Unicode Lyrics URL: ' + lyricsUrl)

                lyricsUrl = JSON.parse('"' + lyricsUrl + '"').replace('"', "");

                appLog('Lyrics URL: ' + lyricsUrl);

                getMusixmatchLyrics(searchQuery, lyricsUrl);

            }
        });
}

function searchMusixmatchSlashTracks(searchQuery) {
    request({ uri: "https://www.musixmatch.com/search/" + encodeURIComponent(searchQuery).replace("%26", "&").replace("%2B", "+") + "/tracks" },
        function (error, response, body) {
            appLog("Search URL: https://www.musixmatch.com/search/" + encodeURIComponent(searchQuery).replace("%26", "&").replace("%2B", "+") + "/tracks")
            if (error != null) {
                //error
                appLog('Search Failed (Internet Error?)')
                setLyrics("", "Error (No Internet?)<br>Try clicking refresh")

            } else if (!body.includes("No tracks found")) {

                var lyricsUrl = body.substring(
                    body.indexOf('"track_share_url":"') + 19,
                    body.indexOf('?utm_source=application')
                );

                appLog('Unicode Lyrics URL: ' + lyricsUrl)

                lyricsUrl = JSON.parse('"' + lyricsUrl + '"').replace('"', "");

                appLog('Lyrics URL: ' + lyricsUrl);

                getMusixmatchLyrics(searchQuery, lyricsUrl);

            } else {
                //track not found on musixmatch
                appLog('Error: Track not on Musixmatch')
                setLyrics("", "Track not found on Musixmatch.")
            }
        })


}

function getMusixmatchLyrics(searchQuery, lyricUrl) {
    request({ uri: lyricUrl },
        function (error, response, body) {
            if (error != null) {
                //error
                appLog('Can\'t get lyrics (Internet Error?)');
                setLyrics("", "Error (No Internet?)<br>Try clicking refresh")

            } else if (body.includes('>Instrumental<')) {

                //song marked instrumental

                var musixmatchTitle = body.substring(
                    body.indexOf('<title data-react-helmet="true">') + 32,
                    body.indexOf('Lyrics | Musixmatch</title>')
                )

                appLog('Song found on Musixmatch: ' + musixmatchTitle)
                appLog('Error: Song is marked as instrumental');

                var coverUrl = body.substring(
                    body.indexOf('"albumCoverart100x100":"') + 24,
                    body.indexOf('","albumCoverart350x350"')
                )
                coverUrl = JSON.parse('"' + coverUrl + '"').replace('"', "");

                appLog('Cover URL: ' + coverUrl);

                if (!coverUrl.includes('nocover')) {
                    setLyrics(musixmatchTitle, "Song is marked as Instrumental.", coverUrl, lyricUrl);
                } else {
                    setLyrics(musixmatchTitle, "Song is marked as Instrumental.", "none", lyricUrl);
                }


            } else if (body.includes('Lyrics not available') || body.includes("Unfortunately we're not authorized to show these lyrics")) {

                //lyrics not available on Musixmatch

                var musixmatchTitle = body.substring(
                    body.indexOf('<title data-react-helmet="true">') + 32,
                    body.indexOf('Lyrics | Musixmatch</title>')
                )

                appLog('Song found on Musixmatch: ' + musixmatchTitle)
                appLog('Error: Lyrics not available on Musixmatch');

                var coverUrl = body.substring(
                    body.indexOf('"albumCoverart100x100":"') + 24,
                    body.indexOf('","albumCoverart350x350"')
                )
                coverUrl = JSON.parse('"' + coverUrl + '"').replace('"', "");

                appLog('Cover URL: ' + coverUrl);

                if (!coverUrl.includes('nocover')) {
                    setLyrics(musixmatchTitle, "Lyrics not available on Musixmatch.", coverUrl, lyricUrl);
                } else {
                    setLyrics(musixmatchTitle, "Lyrics not available on Musixmatch.", "none", lyricUrl);
                }



            } else {

                var musixmatchTitle = body.substring(
                    body.indexOf('<title data-react-helmet="true">') + 32,
                    body.indexOf('Lyrics | Musixmatch</title>')
                )

                appLog('Song found on Musixmatch: ' + musixmatchTitle)

                var lyrics = "";

                var count = (body.match(/"body":"/g) || []).length;
                if (count == 2 || count == 1) {
                    //When '"body":"' appears 1 or 2 times it means there is only one version of the lyrics so we need the first occurrence  of '"body":"'
                    lyrics = body.substring(
                        body.indexOf(',"body":"') + 9,
                        body.lastIndexOf('","language":')
                    )
                } else if (count == 3) {
                    //When '"body":"' appears 3 times it means that there are 2 versions of the lyrics so we need the second occurrence  of '"body":"' (the one visible on the website)
                    var indexOfFirstBody = body.indexOf(',"body":"');

                    lyrics = body.substring(
                        body.indexOf(',"body":"', (indexOfFirstBody + 1)) + 9,
                        body.lastIndexOf('","language":')
                    )

                }

                lyrics = lyrics.replaceAll("\\n", "<br />").replaceAll("\\", "");

                var coverUrl = body.substring(
                    body.indexOf('"albumCoverart100x100":"') + 24,
                    body.indexOf('","albumCoverart350x350"')
                )
                coverUrl = JSON.parse('"' + coverUrl + '"').replace('"', "");

                appLog('Cover URL: ' + coverUrl);
                //appLog('Lyrics: ' + lyrics);

                if (!coverUrl.includes('nocover')) {
                    setLyrics(musixmatchTitle, lyrics, coverUrl, lyricUrl)
                } else {
                    setLyrics(musixmatchTitle, lyrics, "none", lyricUrl)
                }


            }
        });

}

function setLyrics(searchQuery, lyrics, coverUrl = "none", lyricsUrl = "none") {
    const window = require('electron-main-window').getMainWindow();

    hasRetried = false;
    hasRetried2 = false;

    window.webContents.send('setLyrics', searchQuery + "%%" + lyrics + "%%" + coverUrl + "%%" + lyricsUrl)
}

function appLog(line) {
    fs.appendFileSync(logPath, line + '\n');
    console.log(line)
}

