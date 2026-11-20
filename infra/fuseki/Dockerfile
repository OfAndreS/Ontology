FROM stain/jena-fuseki:5.1.0

USER root
RUN mkdir -p /fuseki/databases /fuseki/configuration /fuseki/system /fuseki/logs \
    && chown -R fuseki:fuseki /fuseki

COPY infra/fuseki/config.ttl /fuseki/configuration/myont.ttl
RUN chown fuseki:fuseki /fuseki/configuration/myont.ttl

USER fuseki
