# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all marker submodules and data
marker_hiddenimports = collect_submodules('marker')
surya_hiddenimports = collect_submodules('surya')
transformers_hiddenimports = collect_submodules('transformers')

# Data files needed by marker and surya
marker_datas = collect_data_files('marker')
surya_datas = collect_data_files('surya')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=marker_datas + surya_datas,
    hiddenimports=[
        *marker_hiddenimports,
        *surya_hiddenimports,
        *transformers_hiddenimports,
        'ebooklib',
        'ebooklib.epub',
        'lxml',
        'lxml.etree',
        'PIL',
        'PIL.Image',
        'torch',
        'torchvision',
        'huggingface_hub',
        'safetensors',
        'tokenizers',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'tkinter',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='peedee-eff-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    target_arch='arm64',
)
