FROM node:6
MAINTAINER Ralf Schimmel, <ralf@gynzy.com>
ADD ./start.sh /start.sh
RUN chmod +x start.sh
ADD ./app /app
RUN cd /app && npm install
ENTRYPOINT /start.sh
CMD ["bash"]