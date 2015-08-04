app.controller( 'DashboardCtrl',
		[ '$scope', '$filter', 'API',
		  function ( $scope, $filter, API ) {
		      $scope.xFunction = function () {
			  return function ( d ) {
			      return d.account;
			  };
		      };
		      $scope.yFunction = function () {
			  return function ( d ) {
			      return d.amount;
			  };
		      };
		      $scope.toolTipContentFunction = function () {
			  return function ( key, x, y, e, graph ) {
			      var details = $scope.balance.details[ key ];
			      return '<md-content><h3>' + key + '</h3>' + '<table>' + _( details ).map( function ( transaction ) {
				  return '<tr><td>' + transaction.date + '</td><td>' + transaction.payee + '</td><td style="text-align: right">' + $filter( 'number' )( transaction.amount, 2 ) + ' ' + transaction.currency + '</td></tr>';
			      } ).join( '' ) + '<tr><th></th><th>Total :</th><th>' + x + ' €</th></tr>' + '</table></md-content>';
			  };
		      };

		      // compute an account's score: from 1 (good) to 10 (bad), 0 is neutral/undecided
		      var score_account = function ( account ) {
			  if ( account.match( /^Income:(salaire|Sécu|Mutuelle)$/ ) ) {
			      return 11;
			  } else if ( account.match( /^Income:(Gift|Remboursement)$/ ) ) {
			      return 12;
			  } else if ( account.match( /^Expenses:(courses|Hang)$/ ) ) {
			      return 1;
			  } else if ( account.match( /^Expenses:Home/ ) ) {
			      return 1;
			  } else if ( account.match( /^Expenses:Health/ ) ) {
			      return 1;
			  } else if ( account.match( /^Expenses:Car/ ) ) {
			      return 4;
			  } else if ( account.match( /^Expenses:(Food|Transport)/ ) ) {
			      return 5;
			  } else if ( account.match( /^Expenses:(Shopping|Leisure)/ ) ) {
			      return 9;
			  } else if ( account.match( /^Expenses:Gadgets/ ) ) {
			      return 10;
			  } else if ( account.match( /^Liabilities/ ) ) {
			      return 1000;
			  } else if ( account.match( /^Assets/ ) ) {
			      return 100;
			  } else {
			      return 0;
			  }
		      };

		      $scope.coloring_score = function ( score ) {
			  var adjusted_score = score;
			  var color_scale = [ '#99f', '#0f0', '#3f0', '#6f0', '#9f0', '#cf0', '#fc0', '#f90', '#f60', '#f30', '#f00' ];

			  if ( score >= 1000 ) {
			      // Liabilities
			      adjusted_score = score - 1000;
			      color_scale = [ '#0ff' ];
			  } else if ( score >= 100 ) {
			      // Assets
			      adjusted_score = score - 100;
			      color_scale = [ '#f0f' ];
			  } else if ( score >= 11 ) {
			      // Income
			      adjusted_score = score - 11;
			      color_scale = [ '#360', '#369' ];
			  }

			  return color_scale[ adjusted_score ];
		      };

		      $scope.color = function () {
			  return function ( d, i ) {
			      return $scope.coloring_score( score_account( d.data.account ) );
			  };
		      };

		      $scope.filter_data = function() {
			  _($scope.balance.buckets).each( function( bucket ) {
			      bucket.data = [];

			      if ( _(bucket.accounts_selected).isEmpty() && bucket.score_threshold === 0 ) {
				  bucket.data = bucket.raw_data;
			      } else {
				  _(bucket.accounts_selected).each( function( account_selected ) {
				      bucket.data = bucket.data.concat( $filter('filter')( bucket.raw_data, account_selected, true ) );
				  } );
			      }

			      bucket.total_detailed = _.chain( bucket.data )
				  .groupBy( function( account ) {
				      return account.account.split(':')[0];
				  } )
				  .each( function( category ) {
				      category.total = _( category ).reduce( function ( memo, account ) {
					  return memo + account.amount;
				      }, 0 );
				  } )
				  .value();
			      bucket.total_detailed = _.chain(bucket.total_detailed)
				  .keys()
				  .map( function( key ) {
				      return { account: key,
					       amount: bucket.total_detailed[key].total };
				  } )
				  .value();

			  } );
		      };

		      $scope.select = { score_higher_than: function( bucket, score ) {
			  bucket.accounts_selected = _(bucket.raw_data).filter( function( account ) {
			      return account.score >= score;
			  } );
		      }};

		      var Bucket = function( categories, period ) {
			  var _this = this;
			  this.categories = categories;
			  this.period = period;
			  this.score_threshold = 0;
			  this.orderBy = 'amount';
			  this.orderDesc = false;
			  this.order_by = function( field ) {
			      if ( _this.orderBy == field ) {
				  _this.orderDesc = !_this.orderDesc;
			      } else {
				  _this.orderBy = field;
			      }
			  };
		      };

		      $scope.depth = 99;
		      var retrieve_data = function () {
			  var from, to, period;

			  if ( $scope.period_offset === $scope.dates_salaries.length ) {
			      $scope.from_date = moment( _($scope.dates_salaries).last() ).add( 1, 'month' ).toDate();

			      from = moment( $scope.from_date );

			      period = 'from ' + from.year() + '-' + ( from.month() + 1 ) + '-' + from.date();
			  } else {
			      $scope.from_date = new Date( $scope.dates_salaries[ $scope.period_offset ] );
			      $scope.to_date = ( $scope.period_offset < $scope.dates_salaries.length - 1 ) ? new Date( $scope.dates_salaries[ $scope.period_offset + 1 ] ) : moment( $scope.from_date ).add( 1, 'month' ).toDate();

			      from = moment( $scope.from_date );
			      to = moment( $scope.to_date );

			      period = 'from ' + from.year() + '-' + ( from.month() + 1 ) + '-' + from.date();
			      period += ' to ' + to.year() + '-' + ( to.month() + 1 ) + '-' + to.date();
			  }

			  // API.budget( { period: period,
			  //		categories: 'Expenses' } )
			  //     .then( function( response ) {
			  //	  $scope.budget = response.data;

			  //	  $scope.total_budget = _.chain($scope.budget)
			  //	      .pluck( 'amount' )
			  //	      .reduce( function( acc, amount ) { return acc + amount; },
			  //		       0 )
			  //	      .value();
			  //	  $scope.total_unbudgeted = _($scope.budget).findWhere( { percentage: -1 } ).amount;
			  //     } );

			  $scope.balance = {
			      buckets: [ new Bucket( 'Expenses Liabilities Equity Income', period ),
					 new Bucket( 'Assets', null ) ],
			      details: {}
			  };

			  _($scope.balance.buckets).each( function( bucket ) {
			      API.balance( { period: bucket.period,
					     categories: bucket.categories,
					     depth: $scope.depth } )
				  .then( function ( response ) {
				      bucket.raw_data = _.chain( response.data )
					  .map( function( account ) {
					      account.amount = ( account.amount < 0 ) ? account.amount * -1 : account.amount;
					      account.score = score_account( account.account );
					      return account;
					  } )
					  .sortBy( function ( account ) {
					      return 1 / account.amount;
					  } )
					  .sortBy( function ( account ) {
					      return account.account.split(":")[0];
					  } )
					  .value()
					  .reverse();
				      bucket.raw_total = _( response.data ).reduce( function ( memo, account ) {
					  return memo + account.amount;
				      }, 0 );
				      bucket.accounts_selected = bucket.raw_data;

				      $scope.select.score_higher_than( bucket, bucket.score_threshold );
				      $scope.filter_data();
				  } );
			  } );
		      };

		      $scope.dates_salaries = [];
		      $scope.period_offset = 0;
		      $scope.after = function () {
			  if ( $scope.period_offset < $scope.dates_salaries.length ) {
			      $scope.period_offset++;
			  }
		      };
		      $scope.before = function () {
			  if ( $scope.period_offset > 0 ) {
			      $scope.period_offset--;
			  }
		      };
		      $scope.reset_offset = function () {
			  $scope.period_offset = $scope.dates_salaries.length - 1;
		      };

		      API.accounts()
			  .then( function ( response ) {
			      $scope.accounts = response.data.map( function( account_ary ) {
				  return account_ary.join( ':' );
			      } );
			      API.dates_salaries()
				  .then( function ( response ) {
				      $scope.dates_salaries = response.data;

				      $scope.reset_offset();

				      // retrieve_data() when the value of week_offset changes
				      // n.b.: triggered when week_offset is initialized above
				      $scope.$watch( 'period_offset', function () {
					  retrieve_data();
				      } );

				  } );
			  } );
		  }
		] );