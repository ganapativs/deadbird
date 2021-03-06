const mysql    = require('mysql');
const settings = require('../utils').settings;

let db = settings.db;
let initDone = false;

var pool = mysql.createPool({
  connectionLimit: 10,
  host:       db.host,
  socketPath: db.socketPath,
  database:   db.database,
  user:       db.username,
  password:   db.password,
  charset:    "UTF8_UNICODE_CI"
});

module.exports.init = function(cb) {
  let timeout = setTimeout(() => {
    console.log("Unable to connect to MySQL database. Make sure that you have supplied a valid user/pass/database in settings.json");
    process.exit();
  }, 5000);
  if (initDone) cb();

  pool.on('connection', connection => {
    if (!initDone) {
      clearTimeout(timeout);
      initDone = true;
      cb();
    }
  });

  // Keep connection alive
  keepAlive();
  setInterval(keepAlive, db.keepAliveInterval);

  function keepAlive() {
    pool.getConnection((err, connection) => {
      if (err) return;
      connection.query('SELECT 1', [], () => {
        connection.release();
      });
    });
  }
};

module.exports.connection = {
  query: function () {
    let queryArgs = Array.prototype.slice.call(arguments),
      events = [],
      eventNameIndex = {};

    pool.getConnection((err, conn) => {
      if (err) {
        if (eventNameIndex.error) {
          eventNameIndex.error();
        }
      }
      if (conn) {
        let q = conn.query.apply(conn, queryArgs);
        q.on('end', () => {
          conn.release();
        });

        events.forEach(args => {
          q.on.apply(q, args);
        });
      }
    });

    return {
      on: function (eventName, callback) {
        events.push(Array.prototype.slice.call(arguments));
        eventNameIndex[eventName] = callback;
        return this;
      }
    };
  },
  escape: val => pool.escape(val)
};
