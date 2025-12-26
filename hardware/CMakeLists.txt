cmake_minimum_required(VERSION 3.10)
project(ettus_sdr_hardware)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_package(UHD)
find_package(SoapySDR NO_MODULE)
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

# SoapySDR-based executables (RTL-SDR, HackRF, LimeSDR, etc.)
if(SoapySDR_FOUND)
    message(STATUS "SoapySDR found, building SoapySDR daemons")
    
    add_executable(soapy_streamer src/soapy_streamer.cpp)
    target_link_libraries(soapy_streamer
        ${SoapySDR_LIBRARIES}
        ${FFTW3F_LIBRARIES}
    )
    
    add_executable(soapy_scanner src/soapy_scanner.cpp)
    target_link_libraries(soapy_scanner
        ${SoapySDR_LIBRARIES}
        ${FFTW3F_LIBRARIES}
    )
    
    add_executable(soapy_recorder src/soapy_recorder.cpp)
    target_link_libraries(soapy_recorder
        ${SoapySDR_LIBRARIES}
    )
    
    install(TARGETS soapy_streamer soapy_scanner soapy_recorder DESTINATION bin)
    message(STATUS "SoapySDR libraries: ${SoapySDR_LIBRARIES}")
else()
    message(WARNING "SoapySDR not found, skipping SoapySDR daemons")
endif()

# Install UHD targets
if(UHD_FOUND)
    install(TARGETS sdr_streamer iq_recorder freq_scanner DESTINATION bin)
endif()

if(NOT UHD_FOUND AND NOT SoapySDR_FOUND)
    message(FATAL_ERROR "Neither UHD nor SoapySDR found. Install at least one SDR library.")
endif()

# Print configuration
message(STATUS "UHD version: ${UHD_VERSION}")
message(STATUS "UHD libraries: ${UHD_LIBRARIES}")
message(STATUS "Boost version: ${Boost_VERSION}")
message(STATUS "FFTW3F libraries: ${FFTW3F_LIBRARIES}")
