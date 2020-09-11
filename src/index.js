const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const remote = require("electron").remote;
const path = require('path');
var processWindows = require("node-process-windows");
var request = require("request");
var currentSong = "";
var hasRetried = false;


if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 380,
        height: 600,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    //mainWindow.webContents.openDevTools();

    Menu.setApplicationMenu(null)

    mainWindow.webContents.on('new-window', function (e, url) {
        e.preventDefault();
        require('electron').shell.openExternal(url);
    });

    setInterval(function () {
        getSongInfo();
    }, 1000)

};

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


ipcMain.on("closeButtonEvent", function (event) {
    app.quit();
});

ipcMain.on("minButtonEvent", function (event) {
    BrowserWindow.getFocusedWindow().minimize();
    event.sender.send("btnclick-task-finished", "yes");
});


function getSongInfo() {

    var activeProcesses = processWindows.getProcesses(function (err, processes) {

        processes.forEach(function (p) {
            if (p.processName == "TIDAL" && p.mainWindowTitle != "" && p.mainWindowTitle != "Drag") {


                if (currentSong != p.mainWindowTitle) {

                    if (p.mainWindowTitle == "TIDAL") {
                        currentSong = p.mainWindowTitle;
                        console.log("paused")
                        setLyrics("", "Tidal is paused.")
                    } else {
                        currentSong = p.mainWindowTitle;

                        console.log(p.mainWindowTitle);
                        //Replace ? with * is used because some symbols/characters don't get read correctly by node-process-windows
                        //Replace / with * is used because Musixmatch doesn't like slashes in the search query
                        //Replace " - " with "* - " is used because Tidal sometimes ommits parentheses in the end of a title when it outputs the window title to save up space
                        searchMusixmatch(currentSong.replaceAll("?", "*").replaceAll("/", "*").replaceAll(' - ', '* - '));
                        setLyrics("", "Loading...")
                    }

                }
            }
        });


    });


}


function searchMusixmatch(searchQuery) {
    request({ uri: "https://www.musixmatch.com/search/" + searchQuery },
        function (error, response, body) {
            console.log("https://www.musixmatch.com/search/" + searchQuery)
            if (error != null) {
                //error
                console.log('searchMusixmatch error')
                setLyrics("", "Error.")

            } else if (!body.includes("Best Result")) {

                if (!hasRetried && searchQuery.includes(', ')) {

                    //This is used to retry if it can't find a song due to being on Musixmatch as "Song (feat. ArtistB) - ArtistA" rather than "Song - ArtistA, ArtistB"
                    //It basically keeps only the first artist

                    hasRetried = true;

                    var splitedQuery = searchQuery.split(' - ')
                    var originalArtists = splitedQuery[splitedQuery.length - 1]
                    var firstArtist = originalArtists.substring(0, originalArtists.indexOf(', '))

                    var newSearchQuery = searchQuery.replace(originalArtists, firstArtist)

                    searchMusixmatch(newSearchQuery)


                } else {

                    //track not found on musixmatch
                    console.log('track not found on musixmatch')
                    setLyrics("", "Track not found on Musixmatch.")

                }
            } else {

                var lyricsUrl = body.substring(
                    body.indexOf('"track_edit_url":"') + 18,
                    body.indexOf('edit?utm_source=')
                );
                lyricsUrl = JSON.parse('"' + lyricsUrl + '"').replace('"', "");

                console.log(lyricsUrl);

                getMusixmatchLyrics(searchQuery, lyricsUrl);

            }
        });
}

function getMusixmatchLyrics(searchQuery, lyricUrl) {
    request({ uri: lyricUrl },
        function (error, response, body) {
            if (error != null) {
                //error
                console.log('getMusixmatchLyrics error');
                setLyrics("", "Error.")
            } else if (body.includes('Lyrics not available')) {

                //lyrics not available on Musixmatch
                console.log('lyrics not available on Musixmatch');

                var musixmatchTitle = body.substring(
                    body.indexOf('<title data-react-helmet="true">') + 32,
                    body.indexOf('Lyrics | Musixmatch</title>')
                )

                console.log(musixmatchTitle)

                var coverUrl = body.substring(
                    body.indexOf('"albumCoverart100x100":"') + 24,
                    body.indexOf('","albumCoverart350x350"')
                )
                coverUrl = JSON.parse('"' + coverUrl + '"').replace('"', "");

                console.log(coverUrl);

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

                console.log(musixmatchTitle)

                var lyrics = "";

                var count = (body.match(/"body":"/g) || []).length;
                if (count == 2) {
                    //When body":" appears 2 times it means there is only one version of the lyrics so we need the first occurrence  of '"body":"'
                    lyrics = body.substring(
                        body.indexOf(',"body":"') + 9,
                        body.lastIndexOf('","language":')
                    )
                } else if (count == 3) {
                    //When body":" appears 3 times it means that there are 2 versions of the lyrics so we need the second occurrence  of '"body":"' (the one visible on the website)
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

                console.log(coverUrl);
                console.log(lyrics);

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

    window.webContents.send('setLyrics', searchQuery + "%%" + lyrics + "%%" + coverUrl + "%%" + lyricsUrl)
}

