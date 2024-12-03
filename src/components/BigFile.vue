<template>
  <div>
    <input type="file" ref="fileInput">
    <el-button @click="handleFileUpload">upload</el-button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SparkMD5 from 'spark-md5';
const chunkSize = 1024 * 1024 * 1;
const fileHash = ref("");
const fileName = ref("");
const fileInput = ref(null);

/**
 * 获取文件的 MD5 哈希值
 *
 * @param file 文件对象
 * @returns 返回一个 Promise 对象，resolve 时返回文件的 MD5 哈希值，reject 时返回错误信息
 * @throws 如果在读取文件或计算哈希值过程中发生错误，将抛出错误
 */
const getHash = (file) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);
        fileReader.onload = function (e) {
            try {
                let fileMd5 = SparkMD5.ArrayBuffer.hash(e.target.result);
                resolve(fileMd5);
            } catch (hashError) {
                reject(`Error calculating hash: ${hashError.message}`);
            }
        };
        fileReader.onerror = (error) => {
            reject(`Error reading file for hash calculation: ${error.message}`);
        };
    });
};

/**
 * 将文件分割成多个块（chunks）
 *
 * @param file 要分割的文件
 * @returns 包含文件块的数组，每个块包含以下属性：
 *  - file: 文件块本身
 *  - uploaded: 表示该块是否已上传，初始值为 false
 *  - chunkIndex: 文件块的索引
 *  - fileHash: 文件的哈希值
 */
const createChunks = (file) => {
    const chunks = [];
    let start = 0;
    let index = 0;
    while (start < file.size) {
        let curChunk = file.slice(start, start + chunkSize);
        chunks.push({
            file: curChunk,
            uploaded: false,
            chunkIndex: index,
            fileHash: fileHash.value,
        });
        index++;
        start += chunkSize;
    }
    return chunks;
};

/**
 * 检查文件是否已经上传
 *
 * @param {string} fileHash - 要检查的文件哈希值
 * @returns {Promise<Object>} 返回一个包含文件上传状态的Promise对象
 * @throws {Error} 如果请求失败，将抛出错误
 */
const checkIfUploaded = async (fileHash) => {
    try {
        let response = await fetch('http://localhost:8081/checkUploaded', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileHash: fileHash })
        });
        return response.json();
    } catch (error) {
        throw new Error(`Error checking if file is uploaded: ${error.message}`);
    }
};


/**
 * 处理文件分片上传的函数
 *
 * @param chunk 当前上传的文件分片
 * @param chunks 文件分片数组
 * @returns 返回上传结果
 * @throws 如果上传失败，抛出异常
 */
const uploadHandler = async (chunk, chunks) => {
    try {
        let fd = new FormData();
        fd.append('fileName', fileName.value);
        fd.append('file', chunk.file);
        fd.append('total', chunks.length);
        fd.append('fileHash', chunk.fileHash);
        fd.append('chunkIndex', chunk.chunkIndex);
        let result = await fetch('http://localhost:8081/upload', {
            method: 'POST',
            body: fd
        });
        chunk.uploaded = true;
        return result.json();
    } catch (uploadError) {
        throw new Error(`Error uploading chunk: ${uploadError.message}`);
    }
};


/**
 * 异步合并文件
 *
 * @param fileName 文件名
 * @param fileHash 文件哈希值
 * @param total 总文件数
 * @returns 返回合并后的结果
 * @throws 合并过程中发生错误时抛出异常
 */
const merge = async (fileName, fileHash, total) => {
    try {
        let result = await fetch('http://localhost:8081/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName,
                fileHash: fileHash,
                total: total
            })
        });
        return result.json();
    } catch (mergeError) {
        throw new Error(`Error during merge: ${mergeError.message}`);
    }
};

/**
 * 处理文件上传的逻辑
 *
 * @returns 无返回值
 * @throws 抛出异常，若上传过程中出现错误
 */
const handleFileUpload = async () => {
    try {
        let file = fileInput.value.files[0];
        fileName.value = file.name;
        fileHash.value = await getHash(file);
        let { isUploaded } = await checkIfUploaded(fileHash.value);
        if (isUploaded) {
            console.log('文件已上传，无需再次上传。');
        } else {
            const chunks = createChunks(file);
            const uploadPromises = chunks.map(chunk => uploadHandler(chunk, chunks));
            await Promise.all(uploadPromises);
            await merge(fileName.value, fileHash.value, chunks.length);
            console.log('文件上传并合并完成。');
        }
    } catch (error) {
        console.error(`Error during file upload: ${error.message}`);
    }
};
</script>