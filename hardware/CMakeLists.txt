cmake_minimum_required(VERSION 3.10)
project(sdr_streamer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find UHD
find_package(UHD REQUIRED)

# Find FFTW3
find_library(FFTW3F_LIBRARY fftw3f REQUIRED)

# Add executables
add_executable(sdr_streamer src/sdr_streamer.cpp)
add_executable(iq_recorder src/iq_recorder.cpp)
add_executable(freq_scanner src/freq_scanner.cpp)

# Link libraries
target_link_libraries(sdr_streamer
    ${UHD_LIBRARIES}
    ${FFTW3F_LIBRARY}
    pthread
)

target_link_libraries(iq_recorder
    ${UHD_LIBRARIES}
    pthread
)

target_link_libraries(freq_scanner
    ${UHD_LIBRARIES}
    ${FFTW3F_LIBRARY}
    pthread
)

# Include directories
target_include_directories(sdr_streamer PRIVATE ${UHD_INCLUDE_DIRS})
target_include_directories(iq_recorder PRIVATE ${UHD_INCLUDE_DIRS})
target_include_directories(freq_scanner PRIVATE ${UHD_INCLUDE_DIRS})

# Installation
install(TARGETS sdr_streamer iq_recorder freq_scanner DESTINATION bin)
