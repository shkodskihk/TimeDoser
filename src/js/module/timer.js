API.timer = (function() {
    "use strict";
    // Data
    var data = {
        status: "none",
        changingStatus: false,
        countdownTimeout: false,
        time: {
            minute: 0,
            second: 0
        }
    };

    // Temporal stuff
    var tmp = {};

    // Animates a status change
    // TODO: refactor to make more generic
    function statusChangeAnimation(opt, target) {
        // Default values
        opt.color = opt.color || "#9c27b0";
        opt.cover = opt.cover || false;
        opt.time = opt.time !== null ? opt.time : false;
        opt.close = opt.close !== null ? opt.close : true;
        opt.fab = opt.fab || {};
        opt.fab.position = opt.fab.position || "left";
        opt.fab.icon = opt.fab.icon || "av:play-arrow";
        opt.fab.hide = opt.fab.hide || false;
        opt.callback = opt.callback || function() {
            data.changingStatus = false;
        };

        // Save opt in tmp
        tmp.opt = opt;

        // Get the fab, the helper and the time
        var fab = API.dom.getFAB();
        var helper = API.dom.getAnimationHelper();
        var time = API.dom.getTime();
        var close = API.dom.getClose();

        // Set target
        target = target || fab;

        // Set expansion size
        var expand = opt.expand || 360;

        // Calculate FAB position
        var position = {
            height: target.getBoundingClientRect().height,
            width: target.getBoundingClientRect().width,
            top: target.offsetTop,
            left: target.offsetLeft
        };
        position = {
            top: position.top + (position.height / 2),
            left: position.left + (position.width / 2)
        };

        // Set helper color and initial position and size
        helper.style.top = position.top + "px";
        helper.style.left = position.left + "px";
        helper.style.height = helper.style.width = "0";
        helper.style.backgroundColor = opt.color;

        // Enable transition again
        helper.style.transition = "";

        // Set FAB .cover
        if (opt.cover) {
            helper.classList.add("cover");
        } else {
            helper.classList.remove("cover");
        }

        // Activate helper
        helper.classList.add("on");

        // Hide time and close button
        time.classList.remove("on");
        close.classList.remove("on");

        // Set FAB icon
        fab.setAttribute("icon", opt.fab.icon);

        // Use timeout to force transition
        setTimeout(function() {
            // Listen to transitionend
            helper.addEventListener("transitionend", animationHelperTransitionend);

            // Set final position and size
            helper.style.top = (position.top - (expand / 2)) + "px";
            helper.style.left = (position.left - (expand / 2)) + "px";
            helper.style.height = helper.style.width = expand + "px";
        }, 20);
    }

    // Animator helper transitionend listener
    function animationHelperTransitionend() {
        // Get helper, FAB and time
        var helper = API.dom.getAnimationHelper();
        var fab = API.dom.getFAB();
        var time = API.dom.getTime();
        var close = API.dom.getClose();

        // Get opt from tmp
        var opt = tmp.opt;

        // Remove this event listener
        helper.removeEventListener("transitionend", animationHelperTransitionend);

        // Set the status attribute on body
        document.body.setAttribute("status", getStatus());

        // Reset helper
        helper.classList.remove("on");
        helper.style.transition = "none";
        helper.style.top = helper.style.left = helper.style.height = helper.style.width = "";

        // Set FAB position
        fab.setAttribute("position", opt.fab.position);

        // Show time (baby)
        if (opt.time) {
            time.classList.add("on");
        }

        // Show close button
        if (opt.close) {
            close.classList.add("on");
        }

        // Remove opt from tmp
        delete tmp.opt;

        // Execute the callback
        opt.callback();
    }

    // Sets the standby status
    function setStandbyStatus() {
        stop();
        data.changingStatus = true;
        data.status = "standby";
        statusChangeAnimation({
            color: "#9c27b0",
            time: false,
            close: true,
            fab: {
                position: "right",
                icon: "av:play-arrow"
            }
        });
    }

    // Sets the work status
    function setWorkStatus() {
        data.changingStatus = true;
        data.status = "work";
        statusChangeAnimation({
            color: "#3f51b5",
            time: true,
            close: false,
            fab: {
                position: "left",
                icon: "av:stop"
            },
            callback: function() {
                setTime(0, 5);
                countdown();
                data.changingStatus = false;
            }
        });
    }

    // Sets the break status
    function setBreakStatus() {
        data.changingStatus = true;
        data.status = "break";
        statusChangeAnimation({
            color: "#4caf50",
            time: true,
            close: true,
            fab: {
                position: "left",
                icon: "av:skip-next"
            },
            callback: function() {
                setTime(0, 5);
                countdown();
                data.changingStatus = false;
            }
        });
    }

    // Routes the status input to the appropiate function
    function setStatus(status) {
        if (data.changingStatus) {
            console.error("Status change in progress");
            return;
        }
        if (getStatus() === status) {
            console.error("\"" + status + "\" is the current status");
            return;
        }
        if (status === "standby") {
            setStandbyStatus();
        } else if (status === "work") {
            setWorkStatus();
        } else if (status === "break") {
            setBreakStatus();
        } else {
            console.error("Unknown status \"" + status + "\"");
        }
    }

    // Gets the status
    function getStatus() {
        return data.status;
    }

    // FAB click listener
    function FABClickListener() {
        if (getStatus() === "standby") {
            setStatus("work");
        } else if (getStatus() === "work") {
            setStatus("standby");
        } else if (getStatus() === "break") {
            stop();
            setStatus("work");
        }
    }

    // Initializes the timer
    function init() {
        // Initial status
        setStatus("standby");

        // Attach click listener to FAB
        API.dom.getFAB().addEventListener("click", FABClickListener);

        // Temporal debug fix
        var helper = API.dom.getAnimationHelper();
        helper.style.height = helper.style.width = "0";
    }

    // Sets the time
    function setTime(minute, second) {
        var failed = false;
        if (typeof minute !== "number" || isNaN(minute)) {
            console.error("The \"minute\" parameter is not a valid number");
            failed = true;
        }
        if (typeof second !== "number" || isNaN(second)) {
            console.error("The \"second\" parameter is not a valid number");
            failed = true;
        }
        if (failed) {
            return;
        }
        data.time.minute = minute;
        data.time.second = second;
        API.dom.updateTime(minute, second);
    }

    // Recurrent countdown
    function countdown(next) {
        // Parameter default value
        next = next || false;

        // If second < 0, -1 minute
        if (data.time.second < 0) {
            data.time.second = 59;
            data.time.minute--;
        }

        // Update time element
        API.dom.updateTime(data.time.minute, data.time.second);

        /* TODO: title updater
            // Focus the window  and always on top from 5s to 2s
            if (libs.timer.data.time.minute === 0 && libs.timer.data.time.second <= 5 && libs.timer.data.time.second > 1) {
                libs.window.data.this.setAlwaysOnTop(true);
                libs.window.data.this.focus();
                console.log("[timer]: [countdown] Focus the window  and always on top from 5s to 2s");
            }
            // Title updater
            if (data.status === "work") {
                var i18nMSG = "titleWork";
            } else if (data.status === "break") {
                var i18nMSG = "titleBreak";
            }
            document.title = DOMminute + ":" + DOMsecond + " (" + chrome.i18n.getMessage(i18nMSG) + ")";
            */

        // If countdown reaches the end
        if (data.time.minute === 0 && data.time.second === 0) {
            // If there's a next status parameter
            if (next) {
                setStatus(next);
                // Normal behavior
            } else {
                if (getStatus() === "work") {
                    setStatus("break");
                } else if (getStatus() === "break") {
                    setStatus("work");
                }
            }
            // If not
        } else {
            // -1 second
            data.time.second--;
            data.countdownTimeout = setTimeout(function() {
                countdown(next);
            }, 1000);
        }
    }

    // Stops the timer
    function stop(callback) {
        clearTimeout(data.countdownTimeout);
        if (callback) {
            callback();
        }
    }

    return {
        setStatus: setStatus,
        getStatus: getStatus,
        changeStatus: statusChangeAnimation,
        init: init,
        data: data,
        setTime: setTime,
        countdown: countdown,
        stop: stop
    };
})();