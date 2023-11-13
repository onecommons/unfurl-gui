FROM ghcr.io/onecommons/unfurl:main

RUN apt-get update --fix-missing && \
    apt-get install -y wget curl git xdg-utils fonts-liberation libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb python3-pip libvulkan1 libu2f-udev nodejs npm


WORKDIR /tmp
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN dpkg -i google-chrome-stable_current_amd64.deb
RUN apt -f install -y

WORKDIR /root
RUN npm i -g yarn
