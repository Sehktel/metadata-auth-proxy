/**
 * ### аутентификатор
 */

const user_pass_regexp = /^([^:]*):(.*)$/;
const cache = require('./cache');

// контекст авторизации
const auth = {
  settings: require('../../config/auth.settings'),
  providers: {

  },
};
const oauth = require('./oauth')(auth);

// создаём методы провайдеров
for(const provider of auth.settings.providers) {
  auth.providers[provider] = require(`./${provider}`);
}

function decodeBase64 (str) {
  return Buffer.from(str, 'base64').toString();
}

function extractAuth(req) {
  let {authorization, impersonation} = req.headers;
  if(authorization) {
    //authorization = authorization.replace('Basic', 'LDAP');
    for(const provider in auth.providers) {
      const settings = auth.settings[provider];
      const {authPrefix} = settings;
      if(authorization.startsWith(authPrefix)) {
        try{
          const key = authorization.substr(authPrefix.length);
          const decoded = user_pass_regexp.exec(decodeBase64(key));
          if(decoded) {
            if(impersonation) {
              impersonation = decodeURIComponent(impersonation);
            }
            return {
              provider,
              settings,
              key,
              username: decoded[1],
              password: decoded[2],
              method: auth.providers[provider],
              impersonation,
            };
          }
        }
        catch (e) {

        }
      }
    }
  }
}

module.exports = function ({cat}, log) {

  /**
   * Получает на вход httpRequest и возвращает Promise с идентификатором пользователя или reject, усли авторизоваться не удалось
   * @param req
   * @return {Promise<string>}
   */
  return async (req, res) => {

    const {paths, is_common, is_mdm, is_log, is_event_source, couchdb_proxy_direct} = req.parsed;

    if(paths[0] === 'auth' && !['ldap','couchdb'].includes(paths[1])) {
      return oauth(req, res);
    }

    // проверяем авторизацию
    const authorization = extractAuth(req);
    if(!authorization) {
      if(is_common || is_mdm || is_log || is_event_source) {
        return {};
      }
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="couchdb auth"');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('Укажите логин и пароль');
      return false;
    }

    if(paths[0] === 'auth' && req.method === 'DELETE') {
      cache.del(authorization.key);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ok: true}));
      return;
    }

    let token = cache.get(authorization.key);
    if(!token) {
      try{
        token = await authorization.method(req, res);
      }
      catch (e) {}
      if(!token) {
        throw new TypeError(`Неверный логин/пароль '${authorization.username}' для провайдера '${authorization.provider}'`);
      }
      cache.put(authorization.key, token, authorization.impersonation);
    }
    let user = cat.users.by_auth(token);
    if(!user) {
      if(is_common) {
        return {};
      }
      throw new TypeError(`Пользователь '${authorization.username}' авторизован провайдером '${authorization.provider
      }', но отсутствует в справочнике 'Пользователи'`);
    }
    if(!user.roles || !(user.roles.includes('ram_reader') || user.roles.includes('ram_editor')) || user.invalid) {
      throw new TypeError(`Пользователю '${user.name}' запрещен вход в программу`);
    }
    // олицетворение - вход от имени другого пользователя
    const impersonation = authorization.impersonation || cache.ext(authorization.key);
    if(user.roles.includes('doc_full') && impersonation) {
      user = cat.users.by_id(impersonation);
      if(!user) {
        throw new TypeError(`Пользователь '${impersonation}' отсутствует в справочнике 'Пользователи'`);
      }
      if(!user.roles || !(user.roles.includes('ram_reader') || user.roles.includes('ram_editor')) || user.invalid) {
        throw new TypeError(`Пользователю '${user.name}' запрещен вход в программу`);
      }
    }

    if(paths[0] === 'auth') {
      res.setHeader('Content-Type', 'application/json');
      const zones = new Set();
      user.subscribers.forEach(({abonent}) => {
        if(abonent.id) {
          zones.add(abonent.id)
        }
      })
      res.setHeader('zones', Array.from(zones).join(','));
      res.write(JSON.stringify(user));
      res.end();
    }
    else {
      return req.user = user;
    }
  }
}
