// utils/workOvertimeChecker.js
const dayjs = require("dayjs");
const WorkSession = require("../models/WorkSession");
const Alert = require("../models/Alert");
const { sendAlert } = require("../controllers/alertController");

const checkOvertimeAlerts = async () => {
  try {
    const now = dayjs();
    const todayStart = now.startOf("day").toDate();

    // Active sessions (not stopped yet) - for today only
    const activeSessions = await WorkSession.find({
      logoutTime: null,
      loginTime: { $gte: todayStart },
    });

    const nowTimeStr = now.format("HH:mm"); // e.g. "19:35"

    for (const session of activeSessions) {
      // 7:30 PM reminder
      if (nowTimeStr >= "19:30") {
        // Check if we already sent this reminder for this session
        const existingReminder = await Alert.findOne({
          userId: session.userId,
          refId: session._id,
          type: "Work",
          message: /not stopped work yet/i,
        });

        if (!existingReminder) {
          await sendAlert({
            userId: session.userId,
            message: "It's 7:30 PM. You have not stopped work yet. If you continue, it will be counted as overtime.",
            type: "Work",
            refId: session._id,
          });
        }
      }
    }

    console.log("Overtime reminder check done");
  } catch (err) {
    console.error("Overtime check error:", err.message);
  }
};

module.exports = checkOvertimeAlerts;
