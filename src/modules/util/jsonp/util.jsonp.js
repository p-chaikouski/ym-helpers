ym.modules.define("util.jsonp", [
    "util.id",
    "util.querystring",
    "util.script"
], function (provide, utilId, querystring, utilScript) {
    var exceededError = { message: 'timeoutExceeded' },
        scriptError = { message: 'scriptError' },
        undefFunc = function () {};

    /**
     * @ignore
     * @function
     * @name util.jsonp Загружает скрипт по указанному url и подает ответ на вход функции-обработчика.
     * @param {Object} options Опции.
     * @param {String} options.url Адрес загрузки скрипта.
     * @param {String} [options.paramName = 'callback'] Название параметра для функции-обработчика.
     * @param {String} [options.padding] Имя пользовательской функции-обработчика (функция не создаётся автоматически).
     * @param {String} [options.paddingKey] Имя функции-обработчика (функция с указанным именем будет создана автоматически).
     * @param {Boolean} [options.noCache] Флаг, запрещающий кэширование скрипта. Добавляет случайное число
     * как параметр.
     * @param {Number} [options.timeout = 30000] Количество миллисекунд, в течение которых должен быть загружен скрипт.
     * Иначе удалять скрипт по истечении этого времени.
     * @param {Object} [options.requestParams] Параметры GET запроса.
     * @param {Boolean} [options.checkResponse = true] Флаг, определяющий нужно ли проверять ответ от сервера.
     * Если true, то при отсутствии поля error в ответе или равного null, promise будет зарезолвен
     * со значением res.response или res (если поле response отсутствует), где res - ответ сервера.
     * Иначе promise будет отклонен со значением res.error.
     * @param {String} [options.responseFieldName = 'response'] Имя поля ответа сервера, содержащее
     * данные.
     * @param {Function} [options.postprocessUrl] Функция для обработки URL перед отправкой запроса.
     * @returns {vow.Promise} Объект-promise.
     */
    function jsonp (options) {
        if (jsonp.handler) {
            return jsonp.handler(options, makeRequest);
        }

        return makeRequest(options);
    }

    function makeRequest (options) {
        var callbackName,
            tag,
            checkResponse = typeof options.checkResponse == 'undefined' ?
                true : options.checkResponse,
            responseFieldName = options.responseFieldName || 'response',
            requestParamsStr = options.requestParams ?
                '&' + querystring.stringify(options.requestParams, null, null, { joinArrays: true }) :
                '',
            deferred = ym.vow.defer(),
            promise = deferred.promise(),
            timeout = options.timeout || 30000,
            exceededTimeout = setTimeout(function () {
                deferred.reject(exceededError);
            }, timeout),
            clearRequest = function () {
                clear(tag, callbackName);
                clearTimeout(exceededTimeout);
                exceededTimeout = null;
            };

        if (!options.padding) {
            callbackName = options.paddingKey || (utilId.prefix() + utilId.gen());
            window[callbackName] = function (res) {
                if (checkResponse) {
                    var error = !res || res.error ||
                        (res[responseFieldName] && res[responseFieldName].error);
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve(res && res[responseFieldName] || res);
                    }
                } else {
                    deferred.resolve(res);
                }
            };
        }

        var url = options.url +
            (/\?/.test(options.url) ? "&" : "?") + (options.paramName || 'callback') + '=' + (options.padding || callbackName) +
            (options.noCache ? '&_=' + Math.floor(Math.random() * 10000000) : '') + requestParamsStr;

        if (options.postprocessUrl) {
            url = options.postprocessUrl(url);
        }

        tag = utilScript.create(url);
        tag.onerror = function () {
            deferred.reject(scriptError);
        };

        promise.then(clearRequest, clearRequest);

        return promise;
    }

    /**
     * @ignore
     * Удаляет тэг script.
     */
    function clear (tag, callbackName) {
        if (callbackName) {
            removeCallback(callbackName);
        }
        // Удаляем тег по таймауту, чтобы не нарваться на синхронную обработку,
        // в странных разных браузерах (IE, Опера старая, Сафари, Хром, ФФ4 ),
        // когда содержимое запрошенного скрипта исполняется прямо на строчке head.appendChild(tag)
        // и соответственно, при попытке удалить тэг кидается исключение.
        setTimeout(function () {
            if (tag && tag.parentNode) {
                tag.parentNode.removeChild(tag);
            }
        }, 0);
    }

    /**
     * @ignore
     * удаляем функцию-обработчик
     */
    function removeCallback (callbackName) {
        // Удаляем jsonp-функцию
        window[callbackName] = undefFunc;
        // удаляем функцию через большой интервал, т.к. содержимое удаленного тэга script может попытаться обратится
        // к этой функции, для этого и делаем заглушку undefFunc
        setTimeout(function () {
            // IE не дает делать delete объектов window
            window[callbackName] = undefined;
            try {
                delete window[callbackName];
            } catch (e) {
            }
        }, 500);
    }

    provide(jsonp);
});
