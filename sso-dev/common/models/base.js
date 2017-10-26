'use strict';

module.exports = function(Base) {
    Base.definition.properties.create_time.default = function() {
        return Math.round(new Date().getTime() / 1000);
    };
    Base.definition.properties.update_time.default = function() {
        return Math.round(new Date().getTime() / 1000);
    };
};
