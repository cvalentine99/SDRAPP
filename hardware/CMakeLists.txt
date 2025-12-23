cmake_minimum_required(VERSION 3.10)
project(sdr_streamer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find UHD
find_package(UHD REQUIRED)

# Find FFTW3
find_library(FFTW3F_LIBRARY fftw3f REQUIRED)

# Add executable
add_executable(sdr_streamer src/sdr_streamer.cpp)

# Link libraries
target_link_libraries(sdr_streamer
    ${UHD_LIBRARIES}
    ${FFTW3F_LIBRARY}
    pthread
)

# Include directories
target_include_directories(sdr_streamer PRIVATE ${UHD_INCLUDE_DIRS})

# Installation
install(TARGETS sdr_streamer DESTINATION bin)
