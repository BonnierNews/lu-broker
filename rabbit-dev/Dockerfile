FROM rabbitmq:3.7-management

COPY ./rabbitmq_delayed_message_exchange-20171201-3.7.x.ez $RABBITMQ_HOME/plugins/

RUN rabbitmq-plugins enable --offline rabbitmq_delayed_message_exchange
RUN rabbitmq-plugins enable --offline rabbitmq_shovel
RUN rabbitmq-plugins enable --offline rabbitmq_shovel_management
