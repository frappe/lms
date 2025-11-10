#!/bin/bash
set -e
# This script configures X11 forwarding for Linux and macOS systems.
# It installs X11, Openbox (on Linux), and checks for XQuartz (on macOS).
# It also updates the sshd_config file to enable X11Forwarding and restarts the SSH service.

# Check if the script is running with root privileges
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script requires root privileges. Please run it as a superuser"
  exit 1
fi

# Function to restart SSH service (Linux)
restart_ssh_linux() {
  if command -v service >/dev/null 2>&1; then
    sudo service ssh restart
  else
    sudo systemctl restart ssh
  fi
}

# Function to restart SSH service (macOS)
restart_ssh_macos() {
  launchctl stop com.openssh.sshd
  launchctl start com.openssh.sshd
}

update_x11_forwarding() {
  if grep -q "X11Forwarding yes" /etc/ssh/sshd_config; then
    echo "X11Forwarding is already set to 'yes' in ssh_config."
  else
    if [[ "$OSTYPE" == "linux-gnu" ]]; then
      # Linux: Use sed for Linux
      sudo sed -i 's/#\?X11Forwarding.*/X11Forwarding yes/' /etc/ssh/sshd_config
    elif [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS: Use sed for macOS
      sudo sed -i -E 's/#X11Forwarding.*/X11Forwarding yes/' /etc/ssh/sshd_config
      restart_ssh_macos
    fi
    if [[ "$OSTYPE" == "linux-gnu" ]]; then
      restart_ssh_linux
    fi
  fi
}

# Determine the operating system
if [[ "$OSTYPE" == "linux-gnu" ]]; then
  # Linux
  if command -v startx >/dev/null 2>&1; then
    echo "X11 is already installed."
  else
    # Check which package manager is available
    if command -v apt-get >/dev/null 2>&1; then
      install_command="sudo apt-get update && sudo apt-get install xorg openbox"
    elif command -v dnf >/dev/null 2>&1; then
      install_command="sudo dnf install xorg-x11-server-Xorg openbox"
    else
      echo "Error: Unable to determine the package manager. Manual installation required."
      exit 1
    fi
  fi
  # Check if the installation command is defined
  if [ -n "$install_command" ]; then
    # Execute the installation command
    if $install_command; then
      echo "X11 and Openbox have been successfully installed."
    else
      echo "Error: Failed to install X11 and Openbox."
      exit 1
    fi
  else
    echo "Error: Unsupported package manager."
    exit 1
  fi

  # Call the function to update X11Forwarding
  update_x11_forwarding

  # Get the IP address of the host dynamically
  host_ip=$(hostname -I | awk '{print $1}')
  xhost + "$host_ip" && xhost + local:
  # Set the DISPLAY variable to the host IP
  export DISPLAY="$host_ip:0.0"
  echo "DISPLAY variable set to $DISPLAY"

elif [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  if command -v xquartz >/dev/null 2>&1; then
    echo "XQuartz is already installed."
  else
    echo "Error: XQuartz is required for X11 forwarding on macOS. Please install XQuartz manually."
    exit 1
  fi

  # Call the function to update X11Forwarding
  update_x11_forwarding

  # Export the DISPLAY variable for macOS
  export DISPLAY=:0
  echo "DISPLAY variable set to $DISPLAY"
else
  echo "Error: Unsupported operating system."
  exit 1
fi
