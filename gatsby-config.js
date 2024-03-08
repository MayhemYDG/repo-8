/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

module.exports = {
  pathPrefix: process.env.PATH_PREFIX || '/dev-site-documentation-template/',
  siteMetadata: {
    pages: [
      {
        title: 'Overview',
        path: '/'
      },
      {
        title: 'Guides',
        path: '/guides/'
      },
      {
        title: 'API Reference',
        description: 'Reference for Firefly API',
        path: '/api/'
      },
      {
        title: 'Support',
        path: '/support/'
      },
      {
        title: 'Release Notes',
        path: '/release-notes/'
      },
    ],
    subPages: [
      {
        title: 'Quickstart',
        path: '/guides/',
      },
      {
        title: 'Concepts',
        path: '/guides/concepts/',
        pages: [
          {
            title: 'Access Tokens',
            path: '/guides/concepts/acess-token.md'
          },
          {
            title: 'Get Credentials',
            path: '/guides/concepts/create-credentials/'
          },
          {
            title: 'Authentication',
            path: '/guides/concepts/authentication/'
          },
          {
            title: 'Image Model Styles',
            path: '/guides/concepts/styles/'
          },
          {
            title: 'Rate limits',
            path: '/guides/concepts/usage_limits/'
          }
        ]
        }, 
        {
          title: 'Tutorials',
          path: '/guides/tutorials/sample-tutorial-one.md',
          pages: [
            {
              title: 'Sample Tutorial One',
              path: '/guides/tutorials/sample-tutorial-one.md'
            },
          ]
        },
        {
          title: 'How-Tos',
          path: '/guides/how_tos/create-your-first-ff-application.md',
          pages:[
            {
              title: 'Create Your First Firefly API Implementation using Node.JS/Python',
              path: '/guides/how_tos/create-your-first-ff-application.md'
            }
          ]
        },
      {
        title: 'Overview',
        path: '/support/',
        header: true,
        pages: [
          {
            title: 'Help',
            path: '/support/'
          },
          {
            title: 'FAQ',
            path: '/support/FAQ/'
          },
          {
            title: 'How to contribute',
            path: '/support/contribute/'
          },
          {
            title: 'Best practices',
            path: '/support/best-practices'
          },
          {
            title: 'Troubleshooting',
            path: '/support/troubleshooting'
          }
        ]
      },
      {
        title: 'Community',
        path: '/support/community/',
        header: true,
        pages: [
          {
            title: 'Information',
            path: '/support/community/'
          }
        ]
      }
    ]
  },
  plugins: [`@adobe/gatsby-theme-aio`]
};
