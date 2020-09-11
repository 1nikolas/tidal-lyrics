const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const remote = require("electron").remote;
const path = require('path');
var processWindows = require("node-process-windows");
var request = require("request");
var currentSong = "";


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 380,
        height: 600,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
        }
    });

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();
    Menu.setApplicationMenu(null)

    mainWindow.webContents.on('new-window', function(e, url) {
        e.preventDefault();
        require('electron').shell.openExternal(url);
      });

    setInterval(function () {
        getSongInfo();
    }, 1000)

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


ipcMain.on("closeButtonEvent", function (event) {
    app.quit();
    //event.sender.send("btnclick-task-finished", "yes");
});

ipcMain.on("minButtonEvent", function (event) {
    BrowserWindow.getFocusedWindow().minimize();
    event.sender.send("btnclick-task-finished", "yes");
});

function getSongInfo() {



    var activeProcesses = processWindows.getProcesses(function (err, processes) {
        
        processes.forEach(function (p) {
            if (p.processName == "TIDAL" && p.mainWindowTitle != "") {

                
                if (currentSong != p.mainWindowTitle) {
                    
                    if (p.mainWindowTitle == "TIDAL") {
                        currentSong = p.mainWindowTitle;
                        console.log("paused")
                        setLyrics("", "Tidal is paused.")
                    } else {
                        currentSong = p.mainWindowTitle;

                        console.log(p.mainWindowTitle);
                        getMusixmatchLyricUrl(currentSong.replaceAll("?", "*").replaceAll("/", "*"));
                        setLyrics("", "Loading...")
                    }

                }
            }
        });


    });


}


function getMusixmatchLyricUrl(songName) {
    request({ uri: "https://www.musixmatch.com/search/" + songName },
        function (error, response, body) {
            console.log("https://www.musixmatch.com/search/" + songName)
            if (error != null) {
                //error
                console.log('getMusixmatchLyricUrl error')
                setLyrics("", "Error.")

            } else if (!body.includes("Best Result")) {
                //track not found on musixmatch
                console.log('track not found on musixmatch')
                setLyrics("", "Track not found on Musixmatch.")
            } else {

                var lyricsUrl = body.substring(
                    body.indexOf('"track_edit_url":"') + 18,
                    body.indexOf('edit?utm_source=')
                );
                lyricsUrl = JSON.parse('"' + lyricsUrl + '"').replace('"', "");

                console.log(lyricsUrl);

                getMusixmatchLyrics(songName, lyricsUrl);

            }
        });
}

function getMusixmatchLyrics(songName, lyricUrl) {
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

                if (!coverUrl.includes('nocover')){
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
                    //lyrics are reviewed (no yello mark on website) so we need the first occurrence  of '"body":"'
                    lyrics = body.substring(
                        body.indexOf(',"body":"') + 9,
                        body.lastIndexOf('","language":')
                    )
                } else if (count == 3) {
                    //lyrics are not reviewed (yellow mark on website) so we need the second occurrence  of '"body":"' (first one is some previewsly submited lyrics not visible on the website)
                    var indexOfFirstBody = body.indexOf(',"body":"');
                    //var indexOfFirstLanguage = body.indexOf('","language":')

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

                if (!coverUrl.includes('nocover')){
                    setLyrics(musixmatchTitle, lyrics, coverUrl, lyricUrl)
                } else {
                    setLyrics(musixmatchTitle, lyrics, "none", lyricUrl)
                }


            }
        });

}

function setLyrics(songName, lyrics, coverUrl = "none", lyricsUrl = "none") {
    const window = require('electron-main-window').getMainWindow();

    window.webContents.send('setLyrics', songName + "%%" + lyrics + "%%" + coverUrl + "%%" + lyricsUrl)
}

