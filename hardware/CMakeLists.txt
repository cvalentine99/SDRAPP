cmake_minimum_required(VERSION 3.10)
project(ettus_sdr_hardware)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(UHD REQUIRED)
find_package(Boost REQUIRED COMPONENTS program_options system thread)
find_package(PkgConfig REQUIRED)
pkg_check_modules(FFTW3F REQUIRED fftw3f)

# Include directories
include_directories(
    ${UHD_INCLUDE_DIRS}
    ${Boost_INCLUDE_DIRS}
    ${FFTW3F_INCLUDE_DIRS}
)

# SDR Streamer executable - Real-time FFT streaming
add_executable(sdr_streamer src/sdr_streamer.cpp)
target_link_libraries(sdr_streamer
    ${UHD_LIBRARIES}
    ${Boost_LIBRARIES}
    ${FFTW3F_LIBRARIES}
)

# IQ Recorder executable - Record raw IQ samples to file
add_executable(iq_recorder src/iq_recorder.cpp)
target_link_libraries(iq_recorder
    ${UHD_LIBRARIES}
    ${Boost_LIBRARIES}
)

# Frequency Scanner executable - Scan frequency range for signals
add_executable(freq_scanner src/freq_scanner.cpp)
target_link_libraries(freq_scanner
    ${UHD_LIBRARIES}
    ${Boost_LIBRARIES}
    ${FFTW3F_LIBRARIES}
)

# Install targets
install(TARGETS sdr_streamer iq_recorder freq_scanner DESTINATION bin)

# Print configuration
message(STATUS "UHD version: ${UHD_VERSION}")
message(STATUS "UHD libraries: ${UHD_LIBRARIES}")
message(STATUS "Boost version: ${Boost_VERSION}")
message(STATUS "FFTW3F libraries: ${FFTW3F_LIBRARIES}")
