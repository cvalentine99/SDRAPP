cmake_minimum_required(VERSION 3.10)
project(sdr_hardware)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(PkgConfig REQUIRED)
find_package(Boost REQUIRED COMPONENTS program_options system thread)

# Find SoapySDR
pkg_check_modules(SOAPYSDR REQUIRED SoapySDR)

# Find FFTW3
pkg_check_modules(FFTW3F REQUIRED fftw3f)

# Include directories
include_directories(
    ${SOAPYSDR_INCLUDE_DIRS}
    ${Boost_INCLUDE_DIRS}
    ${FFTW3F_INCLUDE_DIRS}
)

# Link directories
link_directories(
    ${SOAPYSDR_LIBRARY_DIRS}
    ${FFTW3F_LIBRARY_DIRS}
)

# SDR Streamer executable - Real-time FFT streaming (SoapySDR-based)
add_executable(sdr_streamer src/sdr_streamer.cpp)
target_link_libraries(sdr_streamer
    ${SOAPYSDR_LIBRARIES}
    ${Boost_LIBRARIES}
    ${FFTW3F_LIBRARIES}
    pthread
    rt
)

# IQ Recorder executable - Record raw IQ samples to file
# Note: This still uses UHD - will need separate update if needed
# add_executable(iq_recorder src/iq_recorder.cpp)
# target_link_libraries(iq_recorder
#     ${SOAPYSDR_LIBRARIES}
#     ${Boost_LIBRARIES}
# )

# Frequency Scanner executable - Scan frequency range for signals
# Note: This still uses UHD - will need separate update if needed
# add_executable(freq_scanner src/freq_scanner.cpp)
# target_link_libraries(freq_scanner
#     ${SOAPYSDR_LIBRARIES}
#     ${Boost_LIBRARIES}
#     ${FFTW3F_LIBRARIES}
# )

# Install targets
install(TARGETS sdr_streamer DESTINATION bin)

# Print configuration
message(STATUS "SoapySDR version: ${SOAPYSDR_VERSION}")
message(STATUS "SoapySDR libraries: ${SOAPYSDR_LIBRARIES}")
message(STATUS "Boost version: ${Boost_VERSION}")
message(STATUS "FFTW3F libraries: ${FFTW3F_LIBRARIES}")
